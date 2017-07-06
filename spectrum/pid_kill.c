#include <stdio.h>
#include <string.h>
#include <sys/types.h>
#include <signal.h>
#include <errno.h>

int usage(char *argv[]) {
    fprintf(stderr, "Usage: %s <SIGNUM 2|10|15> <PID>\n", argv[0]);
    return -1;
}

int main(int argc, char *argv[]) {
    if (argc < 3) {
        return usage(argv);
    }

    int sig = atoi(argv[1]);
    if (sig != 0 && sig != SIGINT && sig != SIGTERM && sig != SIGUSR1) {
        return usage(argv);
    }

    pid_t pid = atoi(argv[2]);
    if (pid <= 1) {
        return usage(argv);
    }

    int r = kill(pid, sig);
    if (r != 0) {
        fprintf(stderr, "Error sending signal (%d): %s\n", errno, strerror(errno));
    }

    return r != 0 ? errno : 0;
}
