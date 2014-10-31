#include <stdio.h>
#include <string.h>
#include <unistd.h>
#include <stdlib.h>
#include <hamlib/rig.h>
#include <time.h>

#define VERSION_STRING "1.02"
#define SERIAL_PORT "/dev/icomCiv"
#define FREQ_LIST_LEN 30  // maximum number of frequencies that can be scanned
#define LINE_LEN 300
#define SIGNAL_OFFSET 60 //the AR8600 puts out an RSSI where the noise floor is -51. This will make signals more positive..
#define DEBUG 1
#define CONFIG_FILE "/media/USB1/config.txt"
#define RESULTS_FILE "/media/USB1/results.csv"

struct configStr {
   long minFrequency; // in hz
   long maxFrequency; // in hz
   long step; // in hz
   unsigned int mode; // 0=nbfm, 1=wbfm 
   
};

struct configStr config[FREQ_LIST_LEN];
unsigned int gFrequencyListLen = 0;  //the length of the list of frequencies to scan  
unsigned int gLimitScanConfig = -1; //the line n the config file where we have the first min and max frequency. If 0, then we are not limit scanning 
int gSignal[FREQ_LIST_LEN];


// Structure if the config file 
// frequency1, frequency2, step, mode
// where frequency1 is the frequency in MHz to be scanned, or start frequency when frequency2 exists
//       frequency2 is the stop frequency Note that frequency2 > frequency1. Blank if not needed 
//       step is the stepsize in MHz
//       mode where 0=nbfm, 1=wbfm
// eg
// 103,,,            scan 103MHz. No step, same mode as before 
// 88,108,0.1,1       scan 88 to 108MHz. 100KHz stepsize. wbfm  
unsigned int openConfig( void )
{
	int configLineCounter = 0;
	unsigned int mo=0;
	float min, max,step; 
	FILE *configFile;
	char str[LINE_LEN];
	char *tok;
	unsigned int ret;
	
	if ( DEBUG ) printf("openConfig\n");
		
	configFile = fopen(CONFIG_FILE,"r+"); 
	if (configFile) 
	{
		if ( DEBUG ) printf("openConfig: file:%s exists\n",CONFIG_FILE);
		while ( fgets (str, LINE_LEN, configFile) !=NULL )
		{
    		if ( configLineCounter < FREQ_LIST_LEN)
			{
				if ( strchr(str,'#') == NULL) // ignore comment lines - begining with # 
				{
					ret = sscanf(str, "%f,%f,%f,%d",&min,&max,&step,&mo);
					if ( ret == 4 )
					{
						config[configLineCounter].mode = mo;
						config[configLineCounter].step = step * 1000000;
						config[configLineCounter].maxFrequency = max * 1000000;
						config[configLineCounter].minFrequency = min * 1000000;
						// test for a scan between frequency limits
						if ( config[configLineCounter].maxFrequency )
						{
							printf("Found a config line with both a minimum frequency and a maximum frequency. Now ignoring all other configs and scanning between min and max\n");
							if ( config[configLineCounter].minFrequency > config[configLineCounter].maxFrequency )
							{
								printf("LimitScanMode: minimum frequency cannot be greater than maximum frequency\n");
								exit(1);
							} 
							gLimitScanConfig = configLineCounter;
						}
						configLineCounter++;
					}
					else
					{
						printf("Config file format error: %s\n",str);
					}
				}  // comment line
			}
			else
			{
				printf("Config file frequency list too long\n");
				exit(1);
			}
		}
		
		gFrequencyListLen = configLineCounter;
		if ( DEBUG )
		{
			for ( configLineCounter=0; configLineCounter<gFrequencyListLen; configLineCounter++)
			{
				if ( config[configLineCounter].maxFrequency )
				{
					printf("Config line %d: Range Scan : Min frequency: %ld, Max frequency %ld, Step size %ld, Mode %d\n",configLineCounter, config[configLineCounter].minFrequency, config[configLineCounter].maxFrequency, config[configLineCounter].step, config[configLineCounter].mode ); 
				}
				else
				{
					printf("Config line %d: Single Scan : Frequency: %ld,Mode %d\n",configLineCounter,config[configLineCounter].minFrequency,config[configLineCounter].mode ); 
				} 
			}
		}
		fclose(configFile);
	}
	else
	{
		printf("Can't open file %s\n",CONFIG_FILE);
		exit(1);
	}
}

unsigned int writeResultsHeader( void )
{
	FILE *resultsFile;
	long fCounter;
	
	if ( DEBUG ) printf("writeResultsHeader\n");
	
	resultsFile = fopen(RESULTS_FILE,"a+");
	if (resultsFile) 
	{
		fprintf(resultsFile, "# ");
		if ( gLimitScanConfig != -1 )  // limit scan mode
		{
			for ( fCounter=config[gLimitScanConfig].minFrequency; fCounter < config[gLimitScanConfig].maxFrequency; fCounter += config[gLimitScanConfig].step )
			{
				fprintf(resultsFile, "%lf,",(double)fCounter/1000000);
				//signal[fCounter]=0;
			}
		}
		else  // scanning mode = a list of one or more frequencies
		{
			for ( fCounter=0; fCounter< gFrequencyListLen; fCounter++ )
			{
				fprintf(resultsFile, "%lf,",(double)config[fCounter].minFrequency/1000000);
				//signal[fCounter]=0;
			}
		}
		fprintf(resultsFile,"\n");
		fclose(resultsFile);
	}
	else
	{
		printf("Can't open file %s\n", RESULTS_FILE);
		exit(1);
	}
}

unsigned int writeResults ( void )
{
	FILE *resultsFile;
	char str[20];
	unsigned int frequencyCounter;	
	time_t rawTime;
	
	if ( DEBUG ) printf("writeResults\n");	
	
	resultsFile = fopen(RESULTS_FILE,"a+");
	
	if (resultsFile) 
	{
		time ( &rawTime );
		strftime(str,LINE_LEN,"%d/%m/%y %H:%M:%S ",localtime(&rawTime));
		fprintf(resultsFile,"%s",str);
		
		if ( gLimitScanConfig != -1 )  // limit scan mode
		{
			for ( fCounter=0; fCounter < gFrequencyListLen ; fCounter ++ )
			{
				fprintf(resultsFile,"%i,",gSignal[frequencyCounter]+SIGNAL_OFFSET); 
				//signal[fCounter]=0;
			}
		}
		else  // scanning mode = a list of one or more frequencies
		{
			for ( frequencyCounter=0; frequencyCounter <= gFrequencyListLen; frequencyCounter++ )
			{
				fprintf(resultsFile,"%i,",gSignal[frequencyCounter]+SIGNAL_OFFSET); 
			}
		}	
		fprintf(resultsFile,"\n");
		fflush(resultsFile);
		fclose (resultsFile);
	}	
	else
	{
		printf("Can't open file %s\n",RESULTS_FILE);
		exit(1);
	}
}

int main (int argc, char *argv[])
{
    RIG *my_rig;            /* handle to rig (nstance) */
    freq_t freq;            /* frequency  */
    rmode_t rmode;          /* radio mode of operation */
    pbwidth_t width;
    vfo_t vfo;              /* vfo selection */
    int strength;           /* S-Meter level */
    int retcode;            /* generic return code from functions */
	//long frequency[FREQ_LIST_LEN] = {165937500,166050000,168975000,460075000,453500000,453987500,456125000,456175000,456200000,456225000};

	unsigned int frequencyCounter = 0;
    rig_model_t myrig_model;
	rig_set_debug(RIG_DEBUG_VERBOSE);
	char str[LINE_LEN]; 
	char resultStr[4];
	long lastFrequency, currentFrequency;
	long currentStep;
	unsigned int lastMode, currentMode ;

    printf("Frequency Scanning and logging software \n");
    printf("Version %s\n",VERSION_STRING);
	
	openConfig();
	
	writeResultsHeader();

	if (argc < 2) 
	{
		hamlib_port_t myport;
		myport.type.rig = RIG_PORT_SERIAL;
		myport.parm.serial.rate = 19200;
		myport.parm.serial.data_bits = 8;
		myport.parm.serial.stop_bits = 2;
		myport.parm.serial.parity = RIG_PARITY_NONE;
		myport.parm.serial.handshake = RIG_HANDSHAKE_NONE;
		strncpy(myport.pathname, SERIAL_PORT, FILPATHLEN - 1);

		rig_load_all_backends();
		myrig_model = rig_probe(&myport);
	} 
	else 
	{
		myrig_model = atoi(argv[1]);
	}

	my_rig = rig_init(myrig_model);
	my_rig->state.rigport.parm.serial.stop_bits = 1;
	my_rig->state.rigport.write_delay = 5; 


	if (!my_rig) 
	{
			fprintf(stderr,"failed to find rig number: %d\n", myrig_model);
			exit(1); 
	}

	strncpy(my_rig->state.rigport.pathname,SERIAL_PORT,FILPATHLEN - 1);

	retcode = rig_open(my_rig);
	if (retcode != RIG_OK) 
	{
			printf("rig_open: error = %s\n", rigerror(retcode));
			exit(2);
	}

	printf("Port %s opened ok\n", SERIAL_PORT);

	retcode = rig_set_mode(my_rig, RIG_VFO_CURR, RIG_MODE_WFM, rig_passband_normal(my_rig, RIG_MODE_WFM));
	retcode = rig_set_ts(my_rig, RIG_VFO_CURR, 6250);
	frequencyCounter = 0;
	lastFrequency = 0;
	lastMode = 0 ;
	if ( gLimitScanConfig != -1 ) 
	{
		currentFrequency = config[gLimitScanConfig].minFrequency;
		currentMode = config[gLimitScanConfig].mode;
		currentStep = config[gLimitScanConfig].step;
	}

	while (1)
	{
		frequencyCounter++;
		if ( gLimitScanConfig == -1 )  // scanning mode = a list of one or more frequencies
		{
			frequencyCounter++;
			if (frequencyCounter >= gFrequencyListLen ) // we have reached the end of the list of frequencies. save results and start at the begining 
			{
				writeResults();
				frequencyCounter = 0; 
			}
			currentFrequency = config[frequencyCounter].minFrequency;
			currentMode = config[frequencyCounter].mode;
		}
		else  // range mode - scan between a low and high frequency
		{
			currentFrequency = currentFrequency + currentStep;
			if ( currentFrequency > config[gLimitScanConfig].maxFrequency) // we have reached the max frequency in a limit scan. save results and start again at the bottom 
			{
				writeResults();
				currentFrequency = config[gLimitScanConfig].minFrequency;
				currentMode = config[gLimitScanConfig].mode;
				currentStep = config[gLimitScanConfig].step;
				gFrequencyListLen = frequencyCounter;
				frequencyCounter = 0; 
			}			
		}
			
		// firstly, set the frequency
		if ( lastFrequency != currentFrequency )
		{
			lastFrequency = currentFrequency;
			if ( DEBUG ) printf("main: frequency:%d\n",currentFrequency);
			retcode = rig_set_freq(my_rig, RIG_VFO_CURR, currentFrequency); 
			if (retcode != RIG_OK ) 
			{
				printf("rig_set_freq: error = %s on channel %i with frequency %ld \n", rigerror(retcode), frequencyCounter, currentFrequency);
				usleep(100000);             //in microseconds 
			}
		}
		
		// then set the mode
		if ( lastMode != currentMode )
		{
			lastMode = currentMode;
			if ( currentMode == 0 )
			{ 
				retcode = rig_set_mode(my_rig, RIG_VFO_CURR, RIG_MODE_FM, rig_passband_normal(my_rig, RIG_MODE_FM));
			}
			else
			{ 
				retcode = rig_set_mode(my_rig, RIG_VFO_CURR, RIG_MODE_WFM, rig_passband_normal(my_rig, RIG_MODE_WFM));
			}
			
			if (retcode != RIG_OK ) 
			{
				printf("rig_set_mode: error = %s\n", rigerror(retcode));
				usleep(100000);  //in microseconds 
			}
		}		

		
		// then measure the signal level
		retcode = rig_get_strength(my_rig, RIG_VFO_CURR, &strength);
		if (retcode == RIG_OK ) 
		{
			//printf("rig_get_strength: strength = %i\n", strength);
			//printf("Frequency %lfMHz, Signal %i\n", (double)frequency[frequencyCounter]/1000000, strength);
			gSignal[frequencyCounter]=strength; 
		} 	
		else 
		{
			// and if that did not work, try it again
			printf("rig_get_strength: error =  %s on channel %i \n", rigerror(retcode), frequencyCounter);
			usleep(100000);             //in microseconds 
			retcode = rig_get_strength(my_rig, RIG_VFO_CURR, &strength);
			if (retcode == RIG_OK ) 
			{
				gSignal[frequencyCounter]=strength; 
			} 	
			else 
			{
				printf("2nd rig_get_strength: error =  %s \n", rigerror(retcode));
				usleep(100000); //in microseconds 
			}
		}
	}

	rig_close(my_rig); 
	rig_cleanup(my_rig); 
	printf("port %s closed ok \n",SERIAL_PORT);
	return 0;
}

