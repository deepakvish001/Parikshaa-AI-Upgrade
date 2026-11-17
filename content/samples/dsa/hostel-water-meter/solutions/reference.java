import java.io.*;

public class Main {
    // prefix[i] = litres used on days 1..i, so a range is one subtraction.
    static long[] rangeTotals(long[] litres, int[][] queries) {
        int n = litres.length;
        long[] prefix = new long[n + 1];
        for (int i = 0; i < n; i++) prefix[i + 1] = prefix[i] + litres[i];
        long[] answers = new long[queries.length];
        for (int k = 0; k < queries.length; k++) answers[k] = prefix[queries[k][1]] - prefix[queries[k][0] - 1];
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
