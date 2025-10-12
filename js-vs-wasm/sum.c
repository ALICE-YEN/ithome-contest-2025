__attribute__((export_name("sumSquares")))
double sumSquares(int n) {
    double sum = 0.0;
    for (int i = 1; i <= n; i++) {
        double di = (double)i;
        sum += di * di;
    }
    return sum;
}