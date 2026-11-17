#include <bits/stdc++.h>
using namespace std;

// litres[i] is day i + 1; each query is (l, r), 1-indexed and inclusive.
// Totals can pass 2^31, so they are long long.
vector<long long> rangeTotals(const vector<long long>& litres, const vector<pair<int, int>>& queries) {
    vector<long long> answers(queries.size(), 0);
    // TODO: your code here
    return answers;
}

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    int n, q;
    cin >> n >> q;
    vector<long long> litres(n);
    for (auto& x : litres) cin >> x;
    vector<pair<int, int>> queries(q);
    for (auto& [l, r] : queries) cin >> l >> r;
    string out;
    for (long long s : rangeTotals(litres, queries)) {
        out += to_string(s);
        out += '\n';
    }
    cout << out;
    return 0;
}
