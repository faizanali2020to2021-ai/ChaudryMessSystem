import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'package:intl/intl.dart';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const String kDefaultServerUrl = 'http://10.0.0.191:3000';

void main() {
  runApp(const ChaudryMessApp());
}

// ---------------------------------------------------------------------------
// App Root
// ---------------------------------------------------------------------------
class ChaudryMessApp extends StatefulWidget {
  const ChaudryMessApp({super.key});
  @override
  State<ChaudryMessApp> createState() => _ChaudryMessAppState();
}

class _ChaudryMessAppState extends State<ChaudryMessApp> {
  ThemeMode _themeMode = ThemeMode.light;
  String _serverUrl = kDefaultServerUrl;

  void setTheme(ThemeMode mode) => setState(() => _themeMode = mode);
  void setServerUrl(String url) => setState(() => _serverUrl = url);

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Chaudry Mess',
      debugShowCheckedModeBanner: false,
      themeMode: _themeMode,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF6366F1)),
        useMaterial3: true,
      ),
      darkTheme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF6366F1),
          brightness: Brightness.dark,
        ),
        useMaterial3: true,
      ),
      home: LoginPage(
        serverUrl: _serverUrl,
        onServerUrlChanged: setServerUrl,
        onThemeChanged: setTheme,
        themeMode: _themeMode,
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// API Service
// ---------------------------------------------------------------------------
class ApiService {
  final String baseUrl;
  String username = '';
  String role = '';

  ApiService(this.baseUrl);

  Future<Map<String, dynamic>> get(String path) async {
    final res = await http.get(
      Uri.parse('$baseUrl/api$path'),
      headers: {'x-username': username, 'x-user-role': role},
    ).timeout(const Duration(seconds: 15));
    return json.decode(res.body);
  }

  Future<Map<String, dynamic>> post(String path, Map body) async {
    final res = await http.post(
      Uri.parse('$baseUrl/api$path'),
      headers: {
        'Content-Type': 'application/json',
        'x-username': username,
        'x-user-role': role,
      },
      body: json.encode(body),
    ).timeout(const Duration(seconds: 15));
    return json.decode(res.body);
  }

  Future<Map<String, dynamic>> put(String path, Map body) async {
    final res = await http.put(
      Uri.parse('$baseUrl/api$path'),
      headers: {
        'Content-Type': 'application/json',
        'x-username': username,
        'x-user-role': role,
      },
      body: json.encode(body),
    ).timeout(const Duration(seconds: 15));
    return json.decode(res.body);
  }

  Future<Map<String, dynamic>> delete(String path) async {
    final res = await http.delete(
      Uri.parse('$baseUrl/api$path'),
      headers: {'x-username': username, 'x-user-role': role},
    ).timeout(const Duration(seconds: 15));
    return json.decode(res.body);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
String formatCurrency(dynamic val) {
  final n = double.tryParse(val?.toString() ?? '0') ?? 0;
  return 'Rs. ${n.toStringAsFixed(2)}';
}

String formatDate(dynamic ms) {
  try {
    final dt = DateTime.fromMillisecondsSinceEpoch(int.parse(ms.toString()));
    return DateFormat('dd/MM/yyyy').format(dt);
  } catch (_) {
    return '-';
  }
}

// ---------------------------------------------------------------------------
// Login Page
// ---------------------------------------------------------------------------
class LoginPage extends StatefulWidget {
  final String serverUrl;
  final Function(String) onServerUrlChanged;
  final Function(ThemeMode) onThemeChanged;
  final ThemeMode themeMode;

  const LoginPage({
    super.key,
    required this.serverUrl,
    required this.onServerUrlChanged,
    required this.onThemeChanged,
    required this.themeMode,
  });

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  String _selectedUser = 'admin';
  final _passCtrl = TextEditingController();
  bool _loading = false;
  bool _obscure = true;
  String _shopName = 'Chaudry Mess System';
  late String _serverUrl;

  @override
  void initState() {
    super.initState();
    _serverUrl = widget.serverUrl;
    _loadShopInfo();
  }

  Future<void> _loadShopInfo() async {
    try {
      final res = await http.get(
        Uri.parse('$_serverUrl/api/auth/system-info'),
      ).timeout(const Duration(seconds: 10));
      final data = json.decode(res.body);
      if (data['success'] == true) {
        setState(() => _shopName = data['shopName'] ?? _shopName);
      }
    } catch (_) {}
  }

  Future<void> _login() async {
    setState(() => _loading = true);
    try {
      final res = await http.post(
        Uri.parse('$_serverUrl/api/auth/login'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode({
          'username': _selectedUser,
          'password': _passCtrl.text,
        }),
      ).timeout(const Duration(seconds: 10));
      final data = json.decode(res.body);
      if (data['success'] == true) {
        final api = ApiService(_serverUrl);
        api.username = _selectedUser;
        api.role = data['role'] ?? 'user';
        if (mounted) {
          Navigator.pushReplacement(
            context,
            MaterialPageRoute(
              builder: (_) => MainPage(
                api: api,
                shopName: data['shopName'] ?? _shopName,
                username: _selectedUser,
                role: api.role,
                onThemeChanged: widget.onThemeChanged,
                themeMode: widget.themeMode,
              ),
            ),
          );
        }
      } else {
        _showError(data['message'] ?? 'Login failed');
      }
    } catch (e) {
      _showError('Cannot connect to server.\nCheck server URL: $_serverUrl');
    }
    if (mounted) setState(() => _loading = false);
  }

  void _showError(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(msg), backgroundColor: Colors.red),
    );
  }

  void _showServerDialog() {
    final ctrl = TextEditingController(text: _serverUrl);
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Server URL'),
        content: TextField(
          controller: ctrl,
          decoration: const InputDecoration(
            hintText: 'http://10.0.0.191:3000',
            border: OutlineInputBorder(),
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () {
              setState(() => _serverUrl = ctrl.text.trim());
              widget.onServerUrlChanged(_serverUrl);
              Navigator.pop(context);
              _loadShopInfo();
            },
            child: const Text('Save'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                // Logo
                Container(
                  width: 80, height: 80,
                  decoration: BoxDecoration(
                    color: cs.primary,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Center(
                    child: Text(
                      _shopName.isNotEmpty ? _shopName[0].toUpperCase() : 'M',
                      style: const TextStyle(fontSize: 36, color: Colors.white, fontWeight: FontWeight.bold),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                Text(_shopName, style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.bold)),
                const SizedBox(height: 4),
                Text('Expense Management System', style: TextStyle(color: cs.onSurface.withOpacity(0.6))),
                const SizedBox(height: 32),

                // Card
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text('Sign In', style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold)),
                        const SizedBox(height: 20),

                        // User type
                        DropdownButtonFormField<String>(
                          value: _selectedUser,
                          decoration: const InputDecoration(
                            labelText: 'User Type',
                            border: OutlineInputBorder(),
                            prefixIcon: Icon(Icons.person),
                          ),
                          items: const [
                            DropdownMenuItem(value: 'admin', child: Text('Admin')),
                            DropdownMenuItem(value: 'user', child: Text('User')),
                          ],
                          onChanged: (v) => setState(() => _selectedUser = v!),
                        ),
                        const SizedBox(height: 16),

                        // Password
                        TextField(
                          controller: _passCtrl,
                          obscureText: _obscure,
                          decoration: InputDecoration(
                            labelText: 'Password',
                            border: const OutlineInputBorder(),
                            prefixIcon: const Icon(Icons.lock),
                            suffixIcon: IconButton(
                              icon: Icon(_obscure ? Icons.visibility : Icons.visibility_off),
                              onPressed: () => setState(() => _obscure = !_obscure),
                            ),
                          ),
                          onSubmitted: (_) => _login(),
                        ),
                        const SizedBox(height: 24),

                        ElevatedButton(
                          onPressed: _loading ? null : _login,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: cs.primary,
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(vertical: 14),
                          ),
                          child: _loading
                              ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                              : const Text('Sign In', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                TextButton.icon(
                  onPressed: _showServerDialog,
                  icon: const Icon(Icons.settings),
                  label: Text('Server: $_serverUrl', style: const TextStyle(fontSize: 12)),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Main Page (Bottom Nav)
// ---------------------------------------------------------------------------
class MainPage extends StatefulWidget {
  final ApiService api;
  final String shopName;
  final String username;
  final String role;
  final Function(ThemeMode) onThemeChanged;
  final ThemeMode themeMode;

  const MainPage({
    super.key,
    required this.api,
    required this.shopName,
    required this.username,
    required this.role,
    required this.onThemeChanged,
    required this.themeMode,
  });

  @override
  State<MainPage> createState() => _MainPageState();
}

class _MainPageState extends State<MainPage> {
  int _idx = 0;
  late String _shopName;

  @override
  void initState() {
    super.initState();
    _shopName = widget.shopName;
  }

  @override
  Widget build(BuildContext context) {
    final isAdmin = widget.role == 'admin';
    final pages = [
      DashboardPage(api: widget.api),
      ExpensesPage(api: widget.api, isAdmin: isAdmin),
      PersonsPage(api: widget.api, isAdmin: isAdmin),
      ReportsPage(api: widget.api),
      if (isAdmin) SettingsPage(api: widget.api, shopName: _shopName, username: widget.username, onShopNameChanged: (n) => setState(() => _shopName = n), onThemeChanged: widget.onThemeChanged, themeMode: widget.themeMode),
    ];

    return Scaffold(
      body: pages[_idx],
      bottomNavigationBar: NavigationBar(
        selectedIndex: _idx,
        onDestinationSelected: (i) => setState(() => _idx = i),
        destinations: [
          const NavigationDestination(icon: Icon(Icons.dashboard), label: 'Dashboard'),
          const NavigationDestination(icon: Icon(Icons.receipt_long), label: 'Expenses'),
          const NavigationDestination(icon: Icon(Icons.people), label: 'Members'),
          const NavigationDestination(icon: Icon(Icons.bar_chart), label: 'Reports'),
          if (isAdmin) const NavigationDestination(icon: Icon(Icons.settings), label: 'Settings'),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Dashboard Page
// ---------------------------------------------------------------------------
class DashboardPage extends StatefulWidget {
  final ApiService api;
  const DashboardPage({super.key, required this.api});
  @override
  State<DashboardPage> createState() => _DashboardPageState();
}

class _DashboardPageState extends State<DashboardPage> {
  Map<String, dynamic>? _data;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final data = await widget.api.get('/dashboard');
      setState(() { _data = data; _loading = false; });
    } catch (e) {
      setState(() { _error = e.toString(); _loading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Dashboard'),
        actions: [IconButton(icon: const Icon(Icons.refresh), onPressed: _load)],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Column(mainAxisSize: MainAxisSize.min, children: [Text('Error: $_error'), ElevatedButton(onPressed: _load, child: const Text('Retry'))]))
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      // Summary cards
                      Row(children: [
                        _StatCard('Total Expenses', formatCurrency(_data?['overallSummary']?['totalExpense'] ?? 0), Icons.receipt, Colors.indigo),
                        const SizedBox(width: 12),
                        _StatCard('Total Paid', formatCurrency(_data?['overallSummary']?['totalPaid'] ?? 0), Icons.payments, Colors.green),
                      ]),
                      const SizedBox(height: 12),
                      Row(children: [
                        _StatCard('Members', '${(_data?['personBalances'] as List? ?? []).length}', Icons.people, Colors.orange),
                        const SizedBox(width: 12),
                        _StatCard('This Month', formatCurrency(_data?['overallSummary']?['monthExpense'] ?? 0), Icons.calendar_month, Colors.purple),
                      ]),
                      const SizedBox(height: 20),

                      Text('Member Balances', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
                      const SizedBox(height: 8),
                      ...(_data?['personBalances'] as List? ?? []).map((b) {
                        final bal = double.tryParse(b['remainingBalance'].toString()) ?? 0;
                        final positive = bal >= 0;
                        return Card(
                          margin: const EdgeInsets.only(bottom: 8),
                          child: ListTile(
                            leading: CircleAvatar(
                              backgroundColor: positive ? Colors.green.withOpacity(0.15) : Colors.red.withOpacity(0.15),
                              child: Text(
                                (b['personName'] as String? ?? '?')[0].toUpperCase(),
                                style: TextStyle(color: positive ? Colors.green : Colors.red, fontWeight: FontWeight.bold),
                              ),
                            ),
                            title: Text(b['personName'] ?? '', style: const TextStyle(fontWeight: FontWeight.w600)),
                            subtitle: Text('Paid: ${formatCurrency(b['totalPaid'])}  •  Share: ${formatCurrency(b['totalShare'])}'),
                            trailing: Text(
                              formatCurrency(bal.abs()),
                              style: TextStyle(
                                color: positive ? Colors.green : Colors.red,
                                fontWeight: FontWeight.bold,
                                fontSize: 13,
                              ),
                            ),
                          ),
                        );
                      }),
                    ],
                  ),
                ),
    );
  }
}

Widget _StatCard(String label, String value, IconData icon, Color color) {
  return Expanded(
    child: Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, color: color, size: 20),
            const SizedBox(height: 8),
            Text(value, style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: color)),
            Text(label, style: const TextStyle(fontSize: 11, color: Colors.grey)),
          ],
        ),
      ),
    ),
  );
}

// ---------------------------------------------------------------------------
// Expenses Page
// ---------------------------------------------------------------------------
class ExpensesPage extends StatefulWidget {
  final ApiService api;
  final bool isAdmin;
  const ExpensesPage({super.key, required this.api, required this.isAdmin});
  @override
  State<ExpensesPage> createState() => _ExpensesPageState();
}

class _ExpensesPageState extends State<ExpensesPage> {
  List<dynamic> _expenses = [];
  bool _loading = true;
  String _search = '';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final data = await widget.api.get('/expenses?sortBy=date_desc');
      setState(() {
        _expenses = data['expenses'] ?? [];
        _loading = false;
      });
    } catch (e) {
      setState(() => _loading = false);
    }
  }

  List<dynamic> get _filtered {
    if (_search.isEmpty) return _expenses;
    return _expenses.where((e) =>
      (e['description'] as String? ?? '').toLowerCase().contains(_search.toLowerCase()) ||
      (e['paidByName'] as String? ?? '').toLowerCase().contains(_search.toLowerCase())
    ).toList();
  }

  Future<void> _delete(dynamic id, String desc) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Delete Expense'),
        content: Text('Delete "$desc"?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red, foregroundColor: Colors.white),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
    if (confirm != true) return;
    try {
      await widget.api.delete('/expenses/$id');
      _load();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Expenses'),
        actions: [IconButton(icon: const Icon(Icons.refresh), onPressed: _load)],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(56),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
            child: TextField(
              decoration: InputDecoration(
                hintText: 'Search expenses...',
                prefixIcon: const Icon(Icons.search),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                filled: true,
                fillColor: Theme.of(context).colorScheme.surface,
                contentPadding: const EdgeInsets.symmetric(vertical: 0),
              ),
              onChanged: (v) => setState(() => _search = v),
            ),
          ),
        ),
      ),
      floatingActionButton: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          FloatingActionButton.extended(
            heroTag: 'fab_payment',
            backgroundColor: const Color(0xFF10B981),
            foregroundColor: Colors.white,
            icon: const Icon(Icons.payments),
            label: const Text('Receive Payment', style: TextStyle(fontWeight: FontWeight.bold)),
            onPressed: () async {
              final result = await Navigator.push(context, MaterialPageRoute(builder: (_) => PaymentFormPage(api: widget.api)));
              if (result == true) _load();
            },
          ),
          const SizedBox(height: 12),
          FloatingActionButton.extended(
            heroTag: 'fab_expense',
            icon: const Icon(Icons.add),
            label: const Text('Add Expense'),
            onPressed: () async {
              final result = await Navigator.push(context, MaterialPageRoute(builder: (_) => ExpenseFormPage(api: widget.api)));
              if (result == true) _load();
            },
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: _filtered.isEmpty
                  ? const Center(child: Text('No expenses found'))
                  : ListView.builder(
                      padding: const EdgeInsets.all(12),
                      itemCount: _filtered.length,
                      itemBuilder: (_, i) {
                        final e = _filtered[i];
                        final isPayment = e['category'] == 'Payment';
                        return Card(
                          margin: const EdgeInsets.only(bottom: 8),
                          child: ListTile(
                            leading: CircleAvatar(
                              backgroundColor: _categoryColor(e['category']).withOpacity(0.15),
                              child: Icon(_categoryIcon(e['category']), color: _categoryColor(e['category']), size: 20),
                            ),
                            title: Text(e['description'] ?? '', style: const TextStyle(fontWeight: FontWeight.w600), maxLines: 1, overflow: TextOverflow.ellipsis),
                            subtitle: Text('${formatDate(e['date'])} • Paid by: ${e['paidByName'] ?? '-'}'),
                            trailing: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(
                                  formatCurrency(e['amount']),
                                  style: TextStyle(
                                    fontWeight: FontWeight.bold,
                                    color: isPayment ? const Color(0xFF10B981) : Colors.indigo,
                                  ),
                                ),
                                const SizedBox(width: 4),
                                PopupMenuButton(
                                  itemBuilder: (_) => [
                                    const PopupMenuItem(value: 'edit', child: Row(children: [Icon(Icons.edit, size: 18), SizedBox(width: 8), Text('Edit')])),
                                    if (widget.isAdmin) const PopupMenuItem(value: 'delete', child: Row(children: [Icon(Icons.delete, size: 18, color: Colors.red), SizedBox(width: 8), Text('Delete', style: TextStyle(color: Colors.red))])),
                                  ],
                                  onSelected: (v) async {
                                    if (v == 'edit') {
                                      final result = await Navigator.push(context, MaterialPageRoute(builder: (_) => ExpenseFormPage(api: widget.api, expenseId: e['id'])));
                                      if (result == true) _load();
                                    } else if (v == 'delete') {
                                      _delete(e['id'], e['description'] ?? '');
                                    }
                                  },
                                ),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
            ),
    );
  }

  Color _categoryColor(String? cat) {
    switch (cat) {
      case 'Payment': return const Color(0xFF10B981);
      case 'Breakfast': return Colors.orange;
      case 'Lunch': return Colors.green;
      case 'Dinner': return Colors.indigo;
      default: return Colors.grey;
    }
  }

  IconData _categoryIcon(String? cat) {
    switch (cat) {
      case 'Payment': return Icons.payments;
      case 'Breakfast': return Icons.wb_sunny;
      case 'Lunch': return Icons.restaurant;
      case 'Dinner': return Icons.nightlight;
      default: return Icons.category;
    }
  }
}


// ---------------------------------------------------------------------------
// Expense Form Page (Add / Edit)
// ---------------------------------------------------------------------------
class ExpenseFormPage extends StatefulWidget {
  final ApiService api;
  final dynamic expenseId;
  const ExpenseFormPage({super.key, required this.api, this.expenseId});
  @override
  State<ExpenseFormPage> createState() => _ExpenseFormPageState();
}

class _ExpenseFormPageState extends State<ExpenseFormPage> {
  final _formKey = GlobalKey<FormState>();
  final _descCtrl = TextEditingController();
  final _amtCtrl = TextEditingController();
  DateTime _date = DateTime.now();
  String? _category;
  bool _loading = false;
  bool _loadingInit = false;

  List<dynamic> _persons = [];

  // Payer mode
  bool _multiPayer = false;
  int? _singlePayerId;
  final Map<int, TextEditingController> _payerCtrl = {};

  // Split mode
  bool _customSplit = false;
  final Set<int> _splitSelected = {};
  final Map<int, TextEditingController> _splitCtrl = {};

  @override
  void initState() {
    super.initState();
    _initData();
  }

  @override
  void dispose() {
    _descCtrl.dispose();
    _amtCtrl.dispose();
    for (final c in _payerCtrl.values) c.dispose();
    for (final c in _splitCtrl.values) c.dispose();
    super.dispose();
  }

  Future<void> _initData() async {
    setState(() => _loadingInit = true);
    try {
      final personsData = await widget.api.get('/persons');
      _persons = personsData['persons'] ?? [];

      for (final p in _persons) {
        final id = p['id'] as int;
        _payerCtrl[id] = TextEditingController();
        _splitCtrl[id] = TextEditingController();
        _splitSelected.add(id);
      }

      if (widget.expenseId != null) {
        final data = await widget.api.get('/expenses/${widget.expenseId}');
        final exp = data['expense'];
        _descCtrl.text = exp['description'] ?? '';
        _amtCtrl.text = exp['amount'].toString();
        _date = DateTime.fromMillisecondsSinceEpoch(int.parse(exp['date'].toString()));
        _category = exp['category'];

        // Restore payers
        final payers = data['payers'] as List? ?? [];
        if (payers.length > 1) {
          _multiPayer = true;
          for (final p in payers) {
            final id = p['personId'] as int;
            _payerCtrl[id]?.text = p['amountPaid'].toString();
          }
        } else {
          _singlePayerId = exp['paidByPersonId'] as int?;
        }

        // Restore split
        final shares = data['shares'] as List? ?? [];
        _splitSelected.clear();
        for (final s in shares) {
          final id = s['personId'] as int;
          _splitSelected.add(id);
          _splitCtrl[id]?.text = s['shareAmount'].toString();
        }
        // Detect custom split if not equal
        if (shares.isNotEmpty) {
          final amounts = shares.map((s) => double.tryParse(s['shareAmount'].toString()) ?? 0).toList();
          final first = amounts.first;
          if (amounts.any((a) => (a - first).abs() > 0.01)) {
            _customSplit = true;
          }
        }
      } else {
        if (_persons.isNotEmpty) _singlePayerId = _persons[0]['id'] as int;
      }
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error loading: $e')));
    }
    if (mounted) setState(() => _loadingInit = false);
  }

  double get _totalAmount => double.tryParse(_amtCtrl.text) ?? 0;

  double get _payerTotal {
    if (!_multiPayer) return _totalAmount;
    return _payerCtrl.values.fold(0.0, (s, c) => s + (double.tryParse(c.text) ?? 0));
  }

  double get _splitTotal {
    if (!_customSplit) return _totalAmount;
    return _splitCtrl.entries
        .where((e) => _splitSelected.contains(e.key))
        .fold(0.0, (s, e) => s + (double.tryParse(e.value.text) ?? 0));
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;

    final amount = _totalAmount;

    // Validate payer
    if (_multiPayer) {
      final diff = (amount - _payerTotal).abs();
      if (diff > 0.02) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Payer amounts (${formatCurrency(_payerTotal)}) must equal total (${formatCurrency(amount)})')),
        );
        return;
      }
    }

    // Validate split
    if (_customSplit) {
      final diff = (amount - _splitTotal).abs();
      if (diff > 0.02) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Split amounts (${formatCurrency(_splitTotal)}) must equal total (${formatCurrency(amount)})')),
        );
        return;
      }
    }

    setState(() => _loading = true);
    try {
      final dateMillis = DateTime(_date.year, _date.month, _date.day, 12, 0, 0).millisecondsSinceEpoch;

      final body = <String, dynamic>{
        'dateMillis': dateMillis,
        'description': _descCtrl.text.trim(),
        'amount': amount,
        'category': _category,
      };

      // Payer
      if (_multiPayer) {
        final payers = _payerCtrl.entries
            .where((e) => (double.tryParse(e.value.text) ?? 0) > 0)
            .map((e) => {'personId': e.key, 'amountPaid': double.parse(e.value.text)})
            .toList();
        body['multiPayers'] = payers;
      } else {
        body['paidByPersonId'] = _singlePayerId;
      }

      // Split
      if (_customSplit) {
        final splits = _splitCtrl.entries
            .where((e) => _splitSelected.contains(e.key) && (double.tryParse(e.value.text) ?? 0) > 0)
            .map((e) => {'personId': e.key, 'shareAmount': double.parse(e.value.text)})
            .toList();
        body['splitMode'] = 'custom';
        body['customSplits'] = splits;
      } else {
        body['splitMode'] = 'equal';
        body['selectedPersonIds'] = _splitSelected.toList();
      }

      Map<String, dynamic> result;
      if (widget.expenseId != null) {
        result = await widget.api.put('/expenses/${widget.expenseId}', body);
      } else {
        result = await widget.api.post('/expenses', body);
      }

      if (result['success'] == true) {
        if (mounted) Navigator.pop(context, true);
      } else {
        if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(result['message'] ?? 'Error')));
      }
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
    }
    if (mounted) setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.expenseId != null ? 'Edit Expense' : 'Add Expense'),
        actions: [
          if (_loading)
            const Padding(padding: EdgeInsets.all(14), child: SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)))
          else
            TextButton(onPressed: _save, child: const Text('Save', style: TextStyle(fontWeight: FontWeight.bold))),
        ],
      ),
      body: _loadingInit
          ? const Center(child: CircularProgressIndicator())
          : Form(
              key: _formKey,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  // Date
                  Card(
                    child: ListTile(
                      leading: const Icon(Icons.calendar_today),
                      title: const Text('Date'),
                      subtitle: Text(DateFormat('dd MMMM yyyy').format(_date)),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () async {
                        final d = await showDatePicker(
                          context: context,
                          initialDate: _date,
                          firstDate: DateTime(2020),
                          lastDate: DateTime.now().add(const Duration(days: 1)),
                        );
                        if (d != null) setState(() => _date = d);
                      },
                    ),
                  ),
                  const SizedBox(height: 12),

                  // Description
                  TextFormField(
                    controller: _descCtrl,
                    decoration: const InputDecoration(
                      labelText: 'Description *',
                      hintText: 'e.g. Dinner, Lunch, Milk...',
                      border: OutlineInputBorder(),
                      prefixIcon: Icon(Icons.description),
                    ),
                    validator: (v) => v == null || v.trim().isEmpty ? 'Required' : null,
                  ),
                  const SizedBox(height: 12),

                  // Category chips
                  Wrap(
                    spacing: 8,
                    children: ['Breakfast', 'Lunch', 'Dinner', 'Others'].map((cat) {
                      final sel = _category == cat;
                      return ChoiceChip(
                        label: Text(cat),
                        selected: sel,
                        onSelected: (v) => setState(() => _category = v ? cat : null),
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: 12),

                  // Amount
                  TextFormField(
                    controller: _amtCtrl,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'^\d*\.?\d{0,2}'))],
                    decoration: const InputDecoration(
                      labelText: 'Amount (Rs.) *',
                      border: OutlineInputBorder(),
                      prefixIcon: Icon(Icons.currency_rupee),
                    ),
                    style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                    validator: (v) {
                      if (v == null || v.isEmpty) return 'Required';
                      if ((double.tryParse(v) ?? 0) <= 0) return 'Enter a valid amount';
                      return null;
                    },
                    onChanged: (_) => setState(() {}),
                  ),
                  const SizedBox(height: 16),

                  // ---- Paid By ----
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text('Paid By', style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.bold)),
                      SegmentedButton<bool>(
                        segments: const [
                          ButtonSegment(value: false, label: Text('Single'), icon: Icon(Icons.person, size: 16)),
                          ButtonSegment(value: true, label: Text('Multi'), icon: Icon(Icons.people, size: 16)),
                        ],
                        selected: {_multiPayer},
                        onSelectionChanged: (s) => setState(() => _multiPayer = s.first),
                        style: ButtonStyle(
                          visualDensity: VisualDensity.compact,
                          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),

                  if (!_multiPayer) ...[
                    DropdownButtonFormField<int>(
                      value: _singlePayerId,
                      decoration: const InputDecoration(border: OutlineInputBorder(), prefixIcon: Icon(Icons.person)),
                      items: _persons.map((p) => DropdownMenuItem<int>(value: p['id'] as int, child: Text(p['name'] as String))).toList(),
                      onChanged: (v) => setState(() => _singlePayerId = v),
                      validator: (v) => v == null ? 'Select payer' : null,
                    ),
                  ] else ...[
                    Card(
                      child: Column(
                        children: _persons.map((p) {
                          final id = p['id'] as int;
                          return ListTile(
                            dense: true,
                            title: Text(p['name'] as String),
                            trailing: SizedBox(
                              width: 100,
                              child: TextField(
                                controller: _payerCtrl[id],
                                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                                inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'^\d*\.?\d{0,2}'))],
                                decoration: const InputDecoration(
                                  hintText: '0.00',
                                  border: OutlineInputBorder(),
                                  contentPadding: EdgeInsets.symmetric(horizontal: 8, vertical: 8),
                                ),
                                onChanged: (_) => setState(() {}),
                              ),
                            ),
                          );
                        }).toList(),
                      ),
                    ),
                    _SummaryRow('Payer Total', _payerTotal, _totalAmount),
                  ],
                  const SizedBox(height: 16),

                  // ---- Split ----
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text('Split Among', style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.bold)),
                      SegmentedButton<bool>(
                        segments: const [
                          ButtonSegment(value: false, label: Text('Equal'), icon: Icon(Icons.balance, size: 16)),
                          ButtonSegment(value: true, label: Text('Custom'), icon: Icon(Icons.edit, size: 16)),
                        ],
                        selected: {_customSplit},
                        onSelectionChanged: (s) => setState(() => _customSplit = s.first),
                        style: ButtonStyle(
                          visualDensity: VisualDensity.compact,
                          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),

                  if (!_customSplit) ...[
                    // Equal split checkboxes
                    Card(
                      child: Column(
                        children: [
                          Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                            child: Row(
                              children: [
                                TextButton(onPressed: () => setState(() => _splitSelected.addAll(_persons.map((p) => p['id'] as int))), child: const Text('Select All')),
                                TextButton(onPressed: () => setState(() => _splitSelected.clear()), child: const Text('Clear')),
                                const Spacer(),
                                if (_splitSelected.isNotEmpty && _totalAmount > 0)
                                  Text(
                                    '${formatCurrency(_totalAmount / _splitSelected.length)}/person',
                                    style: TextStyle(color: Theme.of(context).colorScheme.primary, fontWeight: FontWeight.bold, fontSize: 12),
                                  ),
                              ],
                            ),
                          ),
                          ..._persons.map((p) {
                            final id = p['id'] as int;
                            return CheckboxListTile(
                              dense: true,
                              title: Text(p['name'] as String),
                              value: _splitSelected.contains(id),
                              onChanged: (v) => setState(() => v! ? _splitSelected.add(id) : _splitSelected.remove(id)),
                            );
                          }),
                        ],
                      ),
                    ),
                  ] else ...[
                    // Custom split inputs
                    Card(
                      child: Column(
                        children: _persons.map((p) {
                          final id = p['id'] as int;
                          return ListTile(
                            dense: true,
                            title: Text(p['name'] as String),
                            trailing: SizedBox(
                              width: 100,
                              child: TextField(
                                controller: _splitCtrl[id],
                                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                                inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'^\d*\.?\d{0,2}'))],
                                decoration: const InputDecoration(
                                  hintText: '0.00',
                                  border: OutlineInputBorder(),
                                  contentPadding: EdgeInsets.symmetric(horizontal: 8, vertical: 8),
                                ),
                                onChanged: (v) => setState(() => v.isNotEmpty ? _splitSelected.add(id) : _splitSelected.remove(id)),
                              ),
                            ),
                          );
                        }).toList(),
                      ),
                    ),
                    _SummaryRow('Split Total', _splitTotal, _totalAmount),
                  ],
                  const SizedBox(height: 80),
                ],
              ),
            ),
    );
  }
}

Widget _SummaryRow(String label, double entered, double total) {
  final remaining = total - entered;
  final ok = remaining.abs() < 0.02;
  return Padding(
    padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
    child: Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: const TextStyle(fontWeight: FontWeight.w500)),
        Text(
          ok ? '✓ Balanced' : 'Remaining: ${formatCurrency(remaining.abs())}',
          style: TextStyle(
            color: ok ? Colors.green : Colors.red,
            fontWeight: FontWeight.bold,
            fontSize: 13,
          ),
        ),
      ],
    ),
  );
}

// ---------------------------------------------------------------------------
// Payment Form Page (Receive / Record Payment)
// ---------------------------------------------------------------------------
class PaymentFormPage extends StatefulWidget {
  final ApiService api;
  const PaymentFormPage({super.key, required this.api});
  @override
  State<PaymentFormPage> createState() => _PaymentFormPageState();
}

class _PaymentFormPageState extends State<PaymentFormPage> {
  final _formKey = GlobalKey<FormState>();
  final _descCtrl = TextEditingController();
  final _amtCtrl = TextEditingController();
  DateTime _date = DateTime.now();
  bool _loading = false;
  bool _loadingInit = false;
  List<dynamic> _persons = [];
  int? _payerId;
  int? _receiverId;

  @override
  void initState() {
    super.initState();
    _initData();
  }

  @override
  void dispose() {
    _descCtrl.dispose();
    _amtCtrl.dispose();
    super.dispose();
  }

  Future<void> _initData() async {
    setState(() => _loadingInit = true);
    try {
      final data = await widget.api.get('/persons');
      _persons = data['persons'] ?? [];
      if (_persons.isNotEmpty) {
        _payerId = _persons[0]['id'] as int;
        if (_persons.length > 1) {
          _receiverId = _persons[1]['id'] as int;
        } else {
          _receiverId = _persons[0]['id'] as int;
        }
      }
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
    }
    if (mounted) setState(() => _loadingInit = false);
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    if (_payerId == null || _receiverId == null) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Select both Payer and Receiver')));
      return;
    }
    if (_payerId == _receiverId) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Paid By and Received By cannot be the same member!')));
      return;
    }

    setState(() => _loading = true);
    try {
      final dateMillis = DateTime(_date.year, _date.month, _date.day, 12, 0, 0).millisecondsSinceEpoch;
      final body = {
        'dateMillis': dateMillis,
        'paidByPersonId': _payerId,
        'receivedByPersonId': _receiverId,
        'amount': double.parse(_amtCtrl.text),
        'description': _descCtrl.text.trim(),
      };

      final result = await widget.api.post('/payments', body);
      if (result['success'] == true) {
        if (mounted) Navigator.pop(context, true);
      } else {
        if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(result['message'] ?? 'Error')));
      }
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
    }
    if (mounted) setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Receive Payment'),
        actions: [
          if (_loading)
            const Padding(padding: EdgeInsets.all(14), child: SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)))
          else
            TextButton(onPressed: _save, child: const Text('Save', style: TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF10B981)))),
        ],
      ),
      body: _loadingInit
          ? const Center(child: CircularProgressIndicator())
          : Form(
              key: _formKey,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  Card(
                    child: ListTile(
                      leading: const Icon(Icons.calendar_today),
                      title: const Text('Date'),
                      subtitle: Text(DateFormat('dd MMMM yyyy').format(_date)),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () async {
                        final d = await showDatePicker(
                          context: context,
                          initialDate: _date,
                          firstDate: DateTime(2020),
                          lastDate: DateTime.now().add(const Duration(days: 1)),
                        );
                        if (d != null) setState(() => _date = d);
                      },
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Paid By
                  const Text('Paid By (کس نے دیا / ادا کیا - Credit)', style: TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF10B981))),
                  const SizedBox(height: 6),
                  DropdownButtonFormField<int>(
                    value: _payerId,
                    decoration: const InputDecoration(
                      border: OutlineInputBorder(),
                      prefixIcon: Icon(Icons.person, color: Color(0xFF10B981)),
                      helperText: 'اس ممبر کی Paid رقم بڑھ جائے گی',
                      helperStyle: TextStyle(color: Color(0xFF10B981)),
                    ),
                    items: _persons.map((p) => DropdownMenuItem<int>(value: p['id'] as int, child: Text(p['name'] as String))).toList(),
                    onChanged: (v) => setState(() => _payerId = v),
                    validator: (v) => v == null ? 'Select who paid' : null,
                  ),
                  const SizedBox(height: 16),

                  // Received By
                  const Text('Received By (کس کو ملا / وصول کیا - Debit)', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.red)),
                  const SizedBox(height: 6),
                  DropdownButtonFormField<int>(
                    value: _receiverId,
                    decoration: const InputDecoration(
                      border: OutlineInputBorder(),
                      prefixIcon: Icon(Icons.person_outline, color: Colors.red),
                      helperText: 'اس ممبر کا خرچہ / حصہ بڑھ جائے گا',
                      helperStyle: TextStyle(color: Colors.red),
                    ),
                    items: _persons.map((p) => DropdownMenuItem<int>(value: p['id'] as int, child: Text(p['name'] as String))).toList(),
                    onChanged: (v) => setState(() => _receiverId = v),
                    validator: (v) => v == null ? 'Select who received' : null,
                  ),
                  const SizedBox(height: 16),

                  // Amount
                  TextFormField(
                    controller: _amtCtrl,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'^\d*\.?\d{0,2}'))],
                    decoration: const InputDecoration(
                      labelText: 'Payment Amount (Rs.) *',
                      border: OutlineInputBorder(),
                      prefixIcon: Icon(Icons.payments, color: Color(0xFF10B981)),
                    ),
                    style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Color(0xFF10B981)),
                    validator: (v) {
                      if (v == null || v.isEmpty) return 'Required';
                      if ((double.tryParse(v) ?? 0) <= 0) return 'Enter a valid amount';
                      return null;
                    },
                  ),
                  const SizedBox(height: 16),

                  // Description
                  TextFormField(
                    controller: _descCtrl,
                    decoration: const InputDecoration(
                      labelText: 'Description / Notes (Optional)',
                      hintText: 'e.g. Cash settlement, Mess payment, etc.',
                      border: OutlineInputBorder(),
                      prefixIcon: Icon(Icons.notes),
                    ),
                  ),
                  const SizedBox(height: 24),

                  ElevatedButton.icon(
                    onPressed: _loading ? null : _save,
                    icon: const Icon(Icons.check_circle),
                    label: const Text('Save Payment Record', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF10B981),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                    ),
                  ),
                ],
              ),
            ),
    );
  }
}

// ---------------------------------------------------------------------------
// Persons Page
// ---------------------------------------------------------------------------
class PersonsPage extends StatefulWidget {
  final ApiService api;
  final bool isAdmin;
  const PersonsPage({super.key, required this.api, required this.isAdmin});
  @override
  State<PersonsPage> createState() => _PersonsPageState();
}

class _PersonsPageState extends State<PersonsPage> {
  List<dynamic> _persons = [];
  bool _loading = true;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final data = await widget.api.get('/persons');
      setState(() { _persons = data['persons'] ?? []; _loading = false; });
    } catch (_) { setState(() => _loading = false); }
  }

  void _showForm([Map? person]) {
    final nameCtrl = TextEditingController(text: person?['name'] ?? '');
    final mobCtrl = TextEditingController(text: person?['mobileNumber'] ?? '');
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (_) => Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom, left: 16, right: 16, top: 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(person == null ? 'Add Member' : 'Edit Member', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            const SizedBox(height: 16),
            TextField(controller: nameCtrl, decoration: const InputDecoration(labelText: 'Name *', border: OutlineInputBorder())),
            const SizedBox(height: 12),
            TextField(controller: mobCtrl, keyboardType: TextInputType.phone, decoration: const InputDecoration(labelText: 'Mobile (optional)', border: OutlineInputBorder())),
            const SizedBox(height: 16),
            Row(children: [
              Expanded(child: OutlinedButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel'))),
              const SizedBox(width: 12),
              Expanded(child: ElevatedButton(
                onPressed: () async {
                  if (nameCtrl.text.trim().isEmpty) return;
                  Navigator.pop(context);
                  try {
                    if (person == null) {
                      await widget.api.post('/persons', {'name': nameCtrl.text.trim(), 'mobileNumber': mobCtrl.text.trim()});
                    } else {
                      await widget.api.put('/persons/${person['id']}', {'name': nameCtrl.text.trim(), 'mobileNumber': mobCtrl.text.trim()});
                    }
                    _load();
                  } catch (e) {
                    if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
                  }
                },
                child: const Text('Save'),
              )),
            ]),
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Members'),
        actions: [IconButton(icon: const Icon(Icons.refresh), onPressed: _load)],
      ),
      floatingActionButton: FloatingActionButton(onPressed: () => _showForm(), child: const Icon(Icons.person_add)),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView.builder(
              padding: const EdgeInsets.all(12),
              itemCount: _persons.length,
              itemBuilder: (_, i) {
                final p = _persons[i];
                return Card(
                  margin: const EdgeInsets.only(bottom: 8),
                  child: ListTile(
                    leading: CircleAvatar(child: Text((p['name'] as String)[0].toUpperCase())),
                    title: Text(p['name'] ?? ''),
                    subtitle: Text(p['mobileNumber']?.toString().isNotEmpty == true ? p['mobileNumber'] : 'No mobile'),
                    trailing: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        IconButton(icon: const Icon(Icons.edit), onPressed: () => _showForm(p)),
                        if (widget.isAdmin)
                          IconButton(
                            icon: const Icon(Icons.delete, color: Colors.red),
                            onPressed: () async {
                              final ok = await showDialog<bool>(
                                context: context,
                                builder: (_) => AlertDialog(
                                  title: const Text('Delete Member'),
                                  content: Text('Delete "${p['name']}"?'),
                                  actions: [
                                    TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
                                    ElevatedButton(onPressed: () => Navigator.pop(context, true), style: ElevatedButton.styleFrom(backgroundColor: Colors.red, foregroundColor: Colors.white), child: const Text('Delete')),
                                  ],
                                ),
                              );
                              if (ok == true) { await widget.api.delete('/persons/${p['id']}'); _load(); }
                            },
                          ),
                      ],
                    ),
                  ),
                );
              },
            ),
    );
  }
}

// ---------------------------------------------------------------------------
// Reports Page
// ---------------------------------------------------------------------------
class ReportsPage extends StatefulWidget {
  final ApiService api;
  const ReportsPage({super.key, required this.api});
  @override
  State<ReportsPage> createState() => _ReportsPageState();
}

class _ReportsPageState extends State<ReportsPage> with SingleTickerProviderStateMixin {
  late TabController _tab;
  Map<String, dynamic>? _groupData;
  bool _loading = false;

  @override
  void initState() {
    super.initState();
    _tab = TabController(length: 2, vsync: this);
    _loadGroup();
  }

  @override
  void dispose() { _tab.dispose(); super.dispose(); }

  Future<void> _loadGroup() async {
    setState(() => _loading = true);
    try {
      final data = await widget.api.get('/reports/group-summary');
      setState(() { _groupData = data; _loading = false; });
    } catch (e) { setState(() => _loading = false); }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Reports'),
        bottom: TabBar(
          controller: _tab,
          tabs: const [Tab(text: 'Group Summary'), Tab(text: 'Settlement')],
        ),
        actions: [IconButton(icon: const Icon(Icons.refresh), onPressed: _loadGroup)],
      ),
      body: TabBarView(
        controller: _tab,
        children: [
          // Group Summary
          _loading
              ? const Center(child: CircularProgressIndicator())
              : ListView(
                  padding: const EdgeInsets.all(12),
                  children: [
                    Card(
                      color: Theme.of(context).colorScheme.primaryContainer,
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceAround,
                          children: [
                            _InfoCol('Total Expense', formatCurrency(_groupData?['totalExpense'] ?? 0)),
                            _InfoCol('Total Paid', formatCurrency(_groupData?['totalPaid'] ?? 0)),
                            _InfoCol('Members', '${(_groupData?['totalMembers'] ?? 0)}'),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                    ...(_groupData?['balances'] as List? ?? []).map((b) {
                      final bal = double.tryParse(b['remainingBalance'].toString()) ?? 0;
                      final pos = bal >= 0;
                      return Card(
                        margin: const EdgeInsets.only(bottom: 8),
                        child: Padding(
                          padding: const EdgeInsets.all(12),
                          child: Column(
                            children: [
                              Row(
                                children: [
                                  CircleAvatar(child: Text((b['personName'] as String)[0].toUpperCase())),
                                  const SizedBox(width: 12),
                                  Expanded(child: Text(b['personName'] ?? '', style: const TextStyle(fontWeight: FontWeight.bold))),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                    decoration: BoxDecoration(
                                      color: pos ? Colors.green.withOpacity(0.1) : Colors.red.withOpacity(0.1),
                                      borderRadius: BorderRadius.circular(12),
                                    ),
                                    child: Text(
                                      pos ? '▲ ${formatCurrency(bal)}' : '▼ ${formatCurrency(bal.abs())}',
                                      style: TextStyle(color: pos ? Colors.green : Colors.red, fontWeight: FontWeight.bold, fontSize: 13),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 8),
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Text('Paid: ${formatCurrency(b['totalPaid'])}', style: const TextStyle(fontSize: 12, color: Colors.grey)),
                                  Text('Share: ${formatCurrency(b['totalShare'])}', style: const TextStyle(fontSize: 12, color: Colors.grey)),
                                ],
                              ),
                            ],
                          ),
                        ),
                      );
                    }),
                  ],
                ),

          // Settlement
          _loading
              ? const Center(child: CircularProgressIndicator())
              : (_groupData?['settlements'] as List? ?? []).isEmpty
                  ? const Center(child: Column(mainAxisSize: MainAxisSize.min, children: [Icon(Icons.check_circle, color: Colors.green, size: 60), SizedBox(height: 12), Text('All Settled! No pending payments.', style: TextStyle(fontSize: 16))]))
                  : ListView(
                      padding: const EdgeInsets.all(12),
                      children: (_groupData?['settlements'] as List? ?? []).map((s) => Card(
                        margin: const EdgeInsets.only(bottom: 8),
                        child: ListTile(
                          leading: const CircleAvatar(backgroundColor: Colors.orange, child: Icon(Icons.arrow_forward, color: Colors.white)),
                          title: RichText(
                            text: TextSpan(
                              style: DefaultTextStyle.of(context).style,
                              children: [
                                TextSpan(text: s['fromName'], style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.red)),
                                const TextSpan(text: ' pays '),
                                TextSpan(text: s['toName'], style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.green)),
                              ],
                            ),
                          ),
                          trailing: Text(formatCurrency(s['amount']), style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                        ),
                      )).toList(),
                    ),
        ],
      ),
    );
  }
}

Widget _InfoCol(String label, String value) {
  return Column(
    children: [
      Text(value, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
      Text(label, style: const TextStyle(fontSize: 11, color: Colors.grey)),
    ],
  );
}

// ---------------------------------------------------------------------------
// Settings Page (Admin only)
// ---------------------------------------------------------------------------
class SettingsPage extends StatefulWidget {
  final ApiService api;
  final String shopName;
  final String username;
  final Function(String) onShopNameChanged;
  final Function(ThemeMode) onThemeChanged;
  final ThemeMode themeMode;

  const SettingsPage({
    super.key,
    required this.api,
    required this.shopName,
    required this.username,
    required this.onShopNameChanged,
    required this.onThemeChanged,
    required this.themeMode,
  });

  @override
  State<SettingsPage> createState() => _SettingsPageState();
}

class _SettingsPageState extends State<SettingsPage> {
  late TextEditingController _nameCtrl;
  late TextEditingController _addrCtrl;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _nameCtrl = TextEditingController(text: widget.shopName);
    _addrCtrl = TextEditingController();
    _loadSettings();
  }

  @override
  void dispose() { _nameCtrl.dispose(); _addrCtrl.dispose(); super.dispose(); }

  Future<void> _loadSettings() async {
    try {
      final data = await widget.api.get('/auth/system-info');
      setState(() {
        _nameCtrl.text = data['shopName'] ?? widget.shopName;
        _addrCtrl.text = data['shopAddress'] ?? '';
      });
    } catch (_) {}
  }

  Future<void> _saveIdentity() async {
    setState(() => _saving = true);
    try {
      await widget.api.post('/auth/shop-identity', {
        'shopName': _nameCtrl.text.trim(),
        'shopAddress': _addrCtrl.text.trim(),
      });
      widget.onShopNameChanged(_nameCtrl.text.trim());
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Saved!'), backgroundColor: Colors.green));
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
    }
    if (mounted) setState(() => _saving = false);
  }

  void _showChangePassword() {
    final oldCtrl = TextEditingController();
    final newCtrl = TextEditingController();
    final confCtrl = TextEditingController();
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (_) => Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom, left: 16, right: 16, top: 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('Change Password', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            const SizedBox(height: 16),
            TextField(controller: oldCtrl, obscureText: true, decoration: const InputDecoration(labelText: 'Current Password', border: OutlineInputBorder())),
            const SizedBox(height: 12),
            TextField(controller: newCtrl, obscureText: true, decoration: const InputDecoration(labelText: 'New Password', border: OutlineInputBorder())),
            const SizedBox(height: 12),
            TextField(controller: confCtrl, obscureText: true, decoration: const InputDecoration(labelText: 'Confirm Password', border: OutlineInputBorder())),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: () async {
                if (newCtrl.text != confCtrl.text) {
                  ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Passwords do not match')));
                  return;
                }
                Navigator.pop(context);
                try {
                  final res = await widget.api.post('/auth/change-password', {
                    'username': widget.username,
                    'currentPassword': oldCtrl.text,
                    'newPassword': newCtrl.text,
                  });
                  if (mounted) ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text(res['success'] == true ? 'Password changed!' : (res['message'] ?? 'Error')),
                    backgroundColor: res['success'] == true ? Colors.green : Colors.red),
                  );
                } catch (e) {
                  if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
                }
              },
              child: const Text('Change Password'),
            ),
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = widget.themeMode == ThemeMode.dark;
    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text('Shop Identity', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          TextField(controller: _nameCtrl, decoration: const InputDecoration(labelText: 'Shop / Company Name', border: OutlineInputBorder(), prefixIcon: Icon(Icons.store))),
          const SizedBox(height: 12),
          TextField(controller: _addrCtrl, decoration: const InputDecoration(labelText: 'Address', border: OutlineInputBorder(), prefixIcon: Icon(Icons.location_on))),
          const SizedBox(height: 12),
          ElevatedButton(
            onPressed: _saving ? null : _saveIdentity,
            child: _saving ? const CircularProgressIndicator() : const Text('Save Identity'),
          ),
          const Divider(height: 32),

          Text('Appearance', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
          SwitchListTile(
            title: const Text('Dark Mode'),
            secondary: const Icon(Icons.dark_mode),
            value: isDark,
            onChanged: (v) => widget.onThemeChanged(v ? ThemeMode.dark : ThemeMode.light),
          ),
          const Divider(height: 32),

          Text('Account', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
          ListTile(
            leading: const Icon(Icons.lock),
            title: const Text('Change Password'),
            trailing: const Icon(Icons.chevron_right),
            onTap: _showChangePassword,
          ),
        ],
      ),
    );
  }
}
