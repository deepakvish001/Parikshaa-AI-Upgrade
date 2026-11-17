import java.io.*;

public class Main {
    // litres[i] is day i + 1; queries[k] = {l, r}, 1-indexed and inclusive.
    // Totals can pass 2^31, so they are long.
    static long[] rangeTotals(long[] litres, int[][] queries) {
        long[] answers = new long[queries.length];
        // TODO: your code here
        return answers;
    }

    public static void main(String[] args) throws IOException {
        StreamTokenizer in = new StreamTokenizer(new BufferedReader(new InputStreamReader(System.in)));
        in.nextToken();
        int n = (int) in.nval;
        in.nextToken();
        int q = (int) in.nval;
        long[] litres = new long[n];
        for (int i = 0; i < n; i++) {
            in.nextToken();
            litres[i] = (long) in.nval;
        }
        int[][] queries = new int[q][2];
        for (int k = 0; k < q; k++) {
            in.nextToken();
            queries[k][0] = (int) in.nval;
            in.nextToken();
            queries[k][1] = (int) in.nval;
        }
        StringBuilder out = new StringBuilder();
        for (long s : rangeTotals(litres, queries)) out.append(s).append('\n');
        System.out.print(out);
    }
}
