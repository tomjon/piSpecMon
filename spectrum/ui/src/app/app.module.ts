import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms'; //FIXME is this necessary?
import { HttpModule } from '@angular/http';

import { DataService } from './data.service';
import { ErrorService } from './error.service';
import { MessageService } from './message.service';
import { StatusService } from './status.service';
import { UiSettingsService } from './ui-settings.service';
import { StateService } from './state.service';

import { AppComponent } from './app.component';
import { WidgetComponent } from './widget.component';
import { FreqRangeComponent } from './freq-range.component';
import { LoginComponent } from './login.component';
import { IdentComponent } from './ident.component';
import { DetailsComponent } from './details.component';
import { LogsComponent } from './logs.component';
import { StatsComponent } from './stats.component';
import { PiComponent } from './pi.component';
import { PicoComponent } from './pico.component';
import { RigComponent } from './rig.component';
import { AudioComponent } from './audio.component';
import { RdsComponent } from './rds.component';
import { ScanComponent } from './scan.component';
import { ErrorComponent } from './error.component';
import { TableComponent } from './table.component';
import { ChartsComponent } from './charts.component';
import { ProcessComponent } from './process.component';
import { StatusComponent } from './status.component';
import { AmsComponent } from './ams.component';
import { SdrComponent } from './sdr.component';
import { FrequencyComponent } from './frequency.component';
import { LevelComponent } from './level.component';
import { WaterfallComponent } from './waterfall.component';
import { SampleTableComponent } from './sample-table.component';
import { RdsTableComponent } from './rds-table.component';
import { TemperatureComponent } from './temperature.component';

import { InputDirective } from './input.directive';

import { DatePipe } from './date.pipe';
import { FreqPipe } from './freq.pipe';
import { BytesPipe } from './bytes.pipe';

// Add the RxJS Observable operators we need in this module
import './rxjs-operators'; //FIXME is this necessary?

@NgModule({
  declarations: [
    AppComponent,
    WidgetComponent, //FIXME order these coherently
    FreqRangeComponent,
    LoginComponent,
    IdentComponent,
    DetailsComponent,
    LogsComponent,
    StatsComponent,
    PiComponent,
    PicoComponent,
    RigComponent,
    AudioComponent,
    RdsComponent,
    ScanComponent,
    ErrorComponent,
    TableComponent,
    ChartsComponent,
    ProcessComponent,
    StatusComponent,
    AmsComponent,
    SdrComponent,
    FrequencyComponent,
    LevelComponent,
    WaterfallComponent,
    SampleTableComponent,
    RdsTableComponent,
    TemperatureComponent,
    InputDirective,
    DatePipe,
    FreqPipe,
    BytesPipe
  ],
  imports: [
    BrowserModule,
    FormsModule,
    HttpModule
  ],
  providers: [
    DataService,
    StateService,
    StatusService,
    MessageService,
    ErrorService,
    UiSettingsService,
    FreqPipe
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
