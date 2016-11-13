#include <stdio.h>
#include <stdlib.h>
#include <string.h>

const char *commands[3][2] = { 
    { "reboot", "shutdown -r now" },
    { "shutdown", "shutdown -h now" },
    NULL
};

void usage(char *argv[]) {
    printf("Usage: %s [", argv[0]);
    int i = -1;
    while (++i >= 0) {
        if (commands[i][0] == NULL) {
            break;
        }
        if (i > 0) {
            printf("|");
        }
        printf("%s", commands[i][0]);
    }
    printf("]\n");
}

int main(int argc, char *argv[]) {
    if (argc < 2) {
        usage(argv);
        return 0;
    }
    int i = -1;
    while (++i >= 0) {
        if (commands[i][0] == NULL) {
            usage(argv);
            return 1;
        }
        size_t z = strlen(commands[i][0]);
        if (strncmp(argv[1], commands[i][0], z) == 0) {
            break;
        }
    }  

    const char *command = commands[i][1];
    printf("%s\n", command);
    system(command);
}
