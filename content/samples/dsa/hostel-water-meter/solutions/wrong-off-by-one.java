import java.io.*;

public class Main {
    // Wrong: subtracts prefix[l] instead of prefix[l - 1], so day l itself is lost.
    public static void main(String[] args) throws IOException {
        StreamTokenizer in = new StreamTokenizer(new BufferedReader(new InputStreamReader(System.in)));
        in.nextToken();
        int n = (int) in.nval;
        in.nextToken();
        int q = (int) in.nval;
        long[] prefix = new long[n + 1];
        for (int i = 0; i < n; i++) {
            in.nextToken();
            prefix[i + 1] = prefix[i] + (long) in.nval;
        }
        StringBuilder out = new StringBuilder();
        for (int k = 0; k < q; k++) {
            in.nextToken();
            int l = (int) in.nval;
            in.nextToken();
            int r = (int) in.nval;
            out.append(prefix[r] - prefix[l]).append('\n');
        }
        System.out.print(out);
    }
}
