#include <stdio.h>
#include <stdlib.h>

static int readInt(void) {
    int c = getchar();
    while (c != EOF && (c < '0' || c > '9')) c = getchar();
    int x = 0;
    while (c >= '0' && c <= '9') {
        x = x * 10 + (c - '0');
        c = getchar();
    }
    return x;
}

/* litres[i] is day i + 1; query k is (ls[k], rs[k]), 1-indexed and inclusive.
   Write each total into answers[k]. Totals can pass 2^31, so they are long long. */
static void rangeTotals(int n, const long long *litres, int q, const int *ls, const int *rs, long long *answers) {
    (void)n; (void)litres; (void)ls; (void)rs;
    for (int k = 0; k < q; k++) answers[k] = 0; /* TODO: your code here */
}

int main(void) {
    int n = readInt();
    int q = readInt();
    long long *litres = malloc((size_t)n * sizeof *litres);
    for (int i = 0; i < n; i++) litres[i] = readInt();
    int *ls = malloc((size_t)q * sizeof *ls);
    int *rs = malloc((size_t)q * sizeof *rs);
    for (int k = 0; k < q; k++) {
        ls[k] = readInt();
        rs[k] = readInt();
    }
    long long *answers = malloc((size_t)q * sizeof *answers);
    rangeTotals(n, litres, q, ls, rs, answers);
    for (int k = 0; k < q; k++) printf("%lld\n", answers[k]);
    return 0;
}
