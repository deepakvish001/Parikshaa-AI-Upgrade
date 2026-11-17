#include <bits/stdc++.h>
using namespace std;

// prefix[i] = litres used on days 1..i, so a range is one subtraction.
vector<long long> rangeTotals(const vector<long long>& litres, const vector<pair<int, int>>& queries) {
    int n = litres.size();
    vector<long long> prefix(n + 1, 0);
    for (int i = 0; i < n; i++) prefix[i + 1] = prefix[i] + litres[i];
    vector<long long> answers;
    answers.reserve(queries.size());
    for (const auto& [l, r] : queries) answers.push_back(prefix[r] - prefix[l - 1]);
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
