#include <bits/stdc++.h>
using namespace std;

// Wrong: prefix sums in int. A total above 2^31 - 1 wraps around.
int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    int n, q;
    cin >> n >> q;
    vector<int> prefix(n + 1, 0);
    for (int i = 0; i < n; i++) {
        int x;
        cin >> x;
        prefix[i + 1] = prefix[i] + x;
    }
    string out;
    while (q--) {
        int l, r;
        cin >> l >> r;
        out += to_string(prefix[r] - prefix[l - 1]);
        out += '\n';
    }
    cout << out;
    return 0;
}
