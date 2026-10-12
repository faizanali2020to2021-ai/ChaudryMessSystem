import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'package:intl/intl.dart';
import 'package:shared_preferences/shared_preferences.dart';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const String kDefaultServerUrl = 'https://chaudrymess.vercel.app';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
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
  bool _rememberMe = true;
  String _shopName = 'Chaudry Mess System';
  late String _serverUrl;

  @override
  void initState() {
    super.initState();
    _serverUrl = widget.serverUrl;
    _loadSavedCredentials();
    _loadShopInfo();
  }

  Future<void> _loadSavedCredentials() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final savedRemember = prefs.getBool('remember_password') ?? true;
      final savedUser = prefs.getString('saved_username');
      final savedPass = prefs.getString('saved_password');
      final savedUrl = prefs.getString('saved_server_url');

      if (mounted) {
        setState(() {
          _rememberMe = savedRemember;
          if (savedUser != null && (savedUser == 'admin' || savedUser == 'user')) {
            _selectedUser = savedUser;
          }
          if (savedRemember && savedPass != null) {
            _passCtrl.text = savedPass;
          }
          if (savedUrl != null && savedUrl.isNotEmpty) {
            _serverUrl = savedUrl;
            widget.onServerUrlChanged(savedUrl);
          }
        });
      }
    } catch (_) {}
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
        // Save or clear remembered password
        try {
          final prefs = await SharedPreferences.getInstance();
          await prefs.setBool('remember_password', _rememberMe);
          await prefs.setString('saved_username', _selectedUser);
          await prefs.setString('saved_server_url', _serverUrl);
          if (_rememberMe) {
            await prefs.setString('saved_password', _passCtrl.text);
          } else {
            await prefs.remove('saved_password');
          }
        } catch (_) {}

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
            hintText: 'https://chaudrymess.vercel.app',
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
                        const SizedBox(height: 8),

                        // Remember Password Checkbox
                        CheckboxListTile(
                          contentPadding: EdgeInsets.zero,
                          dense: true,
                          title: const Text(
                            'Remember Password',
                            style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500),
                          ),
                          value: _rememberMe,
                          onChanged: (val) {
                            setState(() => _rememberMe = val ?? false);
                          },
                          controlAffinity: ListTileControlAffinity.leading,
                        ),
                        const SizedBox(height: 16),

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
                      // Active Batch Banner
                      if (_data?['activeBatch'] != null) ...[
                        Card(
                          color: const Color(0xFF6366F1).withOpacity(0.08),
                          elevation: 0,
                          shape: RoundedRectangleBorder(
                            side: const BorderSide(color: Color(0xFF6366F1), width: 1.2),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                            child: Row(
                              children: [
                                const CircleAvatar(
                                  backgroundColor: Color(0xFF6366F1),
                                  radius: 18,
                                  child: Icon(Icons.calendar_month, color: Colors.white, size: 20),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        _data!['activeBatch']['name'] ?? 'Active Batch',
                                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: Color(0xFF4338CA)),
                                      ),
                                      const SizedBox(height: 2),
                                      Text(
                                        '${_data!['activeBatch']['fromDate']} to ${_data!['activeBatch']['toDate']}',
                                        style: TextStyle(fontSize: 12, color: Colors.grey[700]),
                                      ),
                                    ],
                                  ),
                                ),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFF10B981),
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                  child: const Text('ACTIVE', style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold)),
                                ),
                              ],
                            ),
                          ),
                        ),
                        const SizedBox(height: 12),
                      ],

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
            heroTag: 'fab_adjustment',
            backgroundColor: const Color(0xFFF59E0B),
            foregroundColor: Colors.white,
            icon: const Icon(Icons.balance),
            label: const Text('Opening Adj', style: TextStyle(fontWeight: FontWeight.bold)),
            onPressed: () async {
              final result = await Navigator.push(context, MaterialPageRoute(builder: (_) => OpeningAdjustmentFormPage(api: widget.api)));
              if (result == true) _load();
            },
          ),
          const SizedBox(height: 10),
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
          const SizedBox(height: 10),
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
                        final isAdjustment = e['category'] == 'Opening Adjustment';
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
                                    color: isPayment
                                        ? const Color(0xFF10B981)
                                        : (isAdjustment ? const Color(0xFFF59E0B) : Colors.indigo),
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
      case 'Opening Adjustment': return const Color(0xFFF59E0B);
      case 'Breakfast': return Colors.orange;
      case 'Lunch': return Colors.green;
      case 'Dinner': return Colors.indigo;
      default: return Colors.grey;
    }
  }

  IconData _categoryIcon(String? cat) {
    switch (cat) {
      case 'Payment': return Icons.payments;
      case 'Opening Adjustment': return Icons.balance;
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
    if (_loading) return;
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
// Opening Adjustment Form Page (Member to Member Opening / Advance Setup)
// ---------------------------------------------------------------------------
class OpeningAdjustmentFormPage extends StatefulWidget {
  final ApiService api;
  const OpeningAdjustmentFormPage({super.key, required this.api});
  @override
  State<OpeningAdjustmentFormPage> createState() => _OpeningAdjustmentFormPageState();
}

class _OpeningAdjustmentFormPageState extends State<OpeningAdjustmentFormPage> {
  final _formKey = GlobalKey<FormState>();
  final _descCtrl = TextEditingController(text: 'Opening Balance');
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
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Select both Credit and Debit member')));
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
        'description': _descCtrl.text.trim().isEmpty ? 'Opening Balance' : _descCtrl.text.trim(),
      };

      final result = await widget.api.post('/opening-adjustments', body);
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
        title: const Text('Opening Adjustment'),
        actions: [
          if (_loading)
            const Padding(padding: EdgeInsets.all(14), child: SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)))
          else
            TextButton(onPressed: _save, child: const Text('Save', style: TextStyle(fontWeight: FontWeight.bold, color: Color(0xFFF59E0B)))),
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
                      title: const Text('Adjustment Date'),
                      subtitle: Text(DateFormat('dd MMMM yyyy').format(_date)),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () async {
                        final d = await showDatePicker(
                          context: context,
                          initialDate: _date,
                          firstDate: DateTime(2020),
                          lastDate: DateTime(2035),
                        );
                        if (d != null) setState(() => _date = d);
                      },
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Paid By / Adjusted By
                  const Text('Paid By / Adjusted By (کس نے دیا / کریڈٹ ممبر - Credit)', style: TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF10B981))),
                  const SizedBox(height: 6),
                  DropdownButtonFormField<int>(
                    value: _payerId,
                    decoration: const InputDecoration(
                      border: OutlineInputBorder(),
                      prefixIcon: Icon(Icons.person, color: Color(0xFF10B981)),
                      helperText: 'اس ممبر کی Paid رقم / ایڈوانس بڑھ جائے گی',
                      helperStyle: TextStyle(color: Color(0xFF10B981)),
                    ),
                    items: _persons.map((p) => DropdownMenuItem<int>(value: p['id'] as int, child: Text(p['name'] as String))).toList(),
                    onChanged: (v) => setState(() => _payerId = v),
                    validator: (v) => v == null ? 'Select who paid' : null,
                  ),
                  const SizedBox(height: 16),

                  // Received By / Adjusted For
                  const Text('Received By / Adjusted For (کس کے ذمے / ڈیبٹ ممبر - Debit)', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.red)),
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
                      labelText: 'Adjustment Amount (Rs.) *',
                      border: OutlineInputBorder(),
                      prefixIcon: Icon(Icons.balance, color: Color(0xFFF59E0B)),
                    ),
                    style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Color(0xFFF59E0B)),
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
                      hintText: 'e.g. Opening Balance, Previous month advance',
                      border: OutlineInputBorder(),
                      prefixIcon: Icon(Icons.notes),
                    ),
                  ),
                  const SizedBox(height: 24),

                  ElevatedButton.icon(
                    onPressed: _loading ? null : _save,
                    icon: const Icon(Icons.check_circle),
                    label: const Text('Save Opening Adjustment', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFFF59E0B),
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
// Reports Page (All 6 Reports Matching Web App Exactly)
// ---------------------------------------------------------------------------
class ReportsPage extends StatefulWidget {
  final ApiService api;
  const ReportsPage({super.key, required this.api});
  @override
  State<ReportsPage> createState() => _ReportsPageState();
}

class _ReportsPageState extends State<ReportsPage> {
  final List<String> _reportTypes = [
    'Group Summary & Settlement',
    'Total Expense Report',
    'Paid by Person Report',
    'Member Ledger Report',
    'Detail Ledger Report',
    'Day-Wise Expense Report',
  ];

  String _currentType = 'Group Summary & Settlement';
  bool _loading = false;
  Map<String, dynamic>? _reportData;
  List<dynamic> _persons = [];
  int? _selectedPersonId;

  late DateTime _fromDate;
  late DateTime _toDate;

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    _fromDate = DateTime(now.year, now.month, 1);
    _toDate = DateTime(now.year, now.month, now.day, 23, 59, 59);
    _loadPersons();
    _loadReport();
  }

  Future<void> _loadPersons() async {
    try {
      final res = await widget.api.get('/persons');
      if (res['success'] == true) {
        setState(() {
          _persons = res['persons'] ?? [];
          if (_persons.isNotEmpty && _selectedPersonId == null) {
            _selectedPersonId = _persons[0]['id'] as int;
          }
        });
      }
    } catch (_) {}
  }

  Future<void> _loadReport() async {
    setState(() => _loading = true);
    try {
      final fromMs = _fromDate.millisecondsSinceEpoch;
      final toMs = _toDate.millisecondsSinceEpoch;

      if (_currentType == 'Group Summary & Settlement') {
        final data = await widget.api.get('/reports/group-summary');
        setState(() { _reportData = data; _loading = false; });
      } else if (_currentType == 'Total Expense Report') {
        final data = await widget.api.get('/reports/total-expense?fromMillis=$fromMs&toMillis=$toMs');
        setState(() { _reportData = data; _loading = false; });
      } else if (_currentType == 'Paid by Person Report') {
        final data = await widget.api.get('/reports/paid-by-person?fromMillis=$fromMs&toMillis=$toMs');
        setState(() { _reportData = data; _loading = false; });
      } else if (_currentType == 'Member Ledger Report') {
        if (_selectedPersonId == null && _persons.isNotEmpty) {
          _selectedPersonId = _persons[0]['id'] as int;
        }
        if (_selectedPersonId != null) {
          final data = await widget.api.get('/reports/person-ledger?personId=$_selectedPersonId');
          setState(() { _reportData = data; _loading = false; });
        } else {
          setState(() => _loading = false);
        }
      } else if (_currentType == 'Detail Ledger Report') {
        if (_selectedPersonId == null && _persons.isNotEmpty) {
          _selectedPersonId = _persons[0]['id'] as int;
        }
        if (_selectedPersonId != null) {
          final data = await widget.api.get('/reports/person-detail-ledger?personId=$_selectedPersonId');
          setState(() { _reportData = data; _loading = false; });
        } else {
          setState(() => _loading = false);
        }
      } else if (_currentType == 'Day-Wise Expense Report') {
        String url = '/reports/day-wise?fromMillis=$fromMs&toMillis=$toMs';
        if (_selectedPersonId != null) {
          url += '&personId=$_selectedPersonId';
        }
        final data = await widget.api.get(url);
        setState(() { _reportData = data; _loading = false; });
      }
    } catch (e) {
      setState(() => _loading = false);
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error loading report: $e')));
    }
  }

  void _shareWhatsApp(String text, String? mobile) {
    Clipboard.setData(ClipboardData(text: text));
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(mobile != null && mobile.isNotEmpty
            ? 'Report summary copied to clipboard! (Member: $mobile)'
            : 'Report summary copied to clipboard!'),
        backgroundColor: Colors.green,
        duration: const Duration(seconds: 4),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Mess Reports'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loadReport,
            tooltip: 'Refresh Report',
          ),
        ],
      ),
      body: Column(
        children: [
          // Selector Card
          Card(
            margin: const EdgeInsets.fromLTRB(12, 10, 12, 6),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              child: DropdownButtonHideUnderline(
                child: DropdownButton<String>(
                  value: _currentType,
                  isExpanded: true,
                  icon: const Icon(Icons.arrow_drop_down_circle, color: Color(0xFF6366F1)),
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: Colors.black87),
                  items: _reportTypes.map((t) => DropdownMenuItem(value: t, child: Text(t))).toList(),
                  onChanged: (v) {
                    if (v != null) {
                      setState(() => _currentType = v);
                      _loadReport();
                    }
                  },
                ),
              ),
            ),
          ),

          // Filters Card (Only for reports that need filters)
          _buildFilterBar(),

          // Report Content Area
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : RefreshIndicator(
                    onRefresh: _loadReport,
                    child: _buildReportContent(),
                  ),
          ),
        ],
      ),
    );
  }

  Widget _buildFilterBar() {
    final needsDates = _currentType == 'Total Expense Report' ||
        _currentType == 'Paid by Person Report' ||
        _currentType == 'Day-Wise Expense Report';
    final needsPerson = _currentType == 'Member Ledger Report' ||
        _currentType == 'Detail Ledger Report' ||
        _currentType == 'Day-Wise Expense Report';

    if (!needsDates && !needsPerson) return const SizedBox.shrink();

    return Card(
      margin: const EdgeInsets.fromLTRB(12, 4, 12, 8),
      elevation: 0,
      color: Theme.of(context).colorScheme.surfaceVariant.withOpacity(0.4),
      child: Padding(
        padding: const EdgeInsets.all(10),
        child: Column(
          children: [
            if (needsDates)
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      icon: const Icon(Icons.calendar_today, size: 14),
                      label: Text('From: ${DateFormat('dd/MM/yy').format(_fromDate)}', style: const TextStyle(fontSize: 12)),
                      onPressed: () async {
                        final d = await showDatePicker(context: context, initialDate: _fromDate, firstDate: DateTime(2020), lastDate: DateTime(2035));
                        if (d != null) {
                          setState(() => _fromDate = DateTime(d.year, d.month, d.day, 0, 0, 0));
                          _loadReport();
                        }
                      },
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: OutlinedButton.icon(
                      icon: const Icon(Icons.event, size: 14),
                      label: Text('To: ${DateFormat('dd/MM/yy').format(_toDate)}', style: const TextStyle(fontSize: 12)),
                      onPressed: () async {
                        final d = await showDatePicker(context: context, initialDate: _toDate, firstDate: DateTime(2020), lastDate: DateTime(2035));
                        if (d != null) {
                          setState(() => _toDate = DateTime(d.year, d.month, d.day, 23, 59, 59));
                          _loadReport();
                        }
                      },
                    ),
                  ),
                ],
              ),
            if (needsDates && needsPerson) const SizedBox(height: 8),
            if (needsPerson)
              Row(
                children: [
                  Expanded(
                    child: DropdownButtonFormField<int?>(
                      value: _selectedPersonId,
                      decoration: InputDecoration(
                        isDense: true,
                        contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                        labelText: 'Select Member',
                      ),
                      items: [
                        if (_currentType == 'Day-Wise Expense Report')
                          const DropdownMenuItem<int?>(value: null, child: Text('All Members')),
                        ..._persons.map((p) => DropdownMenuItem<int?>(
                              value: p['id'] as int,
                              child: Text(p['name'] as String),
                            )),
                      ],
                      onChanged: (v) {
                        setState(() => _selectedPersonId = v);
                        _loadReport();
                      },
                    ),
                  ),
                  if (_currentType == 'Member Ledger Report' || _currentType == 'Detail Ledger Report') ...[
                    const SizedBox(width: 8),
                    ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF25D366), foregroundColor: Colors.white),
                      icon: const Icon(Icons.share, size: 16),
                      label: const Text('WhatsApp', style: TextStyle(fontSize: 12)),
                      onPressed: () {
                        if (_reportData == null) return;
                        final pName = _reportData?['personName'] ?? (_reportData?['balance']?['personName'] ?? 'Member');
                        final mob = _reportData?['mobileNumber'] ?? (_reportData?['balance']?['mobileNumber'] ?? '');
                        final exp = _reportData?['yourTotalExpense'] ?? (_reportData?['balance']?['totalShare'] ?? 0);
                        final paid = _reportData?['totalPaid'] ?? (_reportData?['balance']?['totalPaid'] ?? 0);
                        final rem = double.tryParse((_reportData?['remainingBalance'] ?? (_reportData?['balance']?['remainingBalance'] ?? 0)).toString()) ?? 0;
                        final isRec = rem >= 0;

                        final msg = "*Chaudry Mess System - Ledger Report*\n"
                            "Member: *$pName*\n"
                            "-----------------------------------\n"
                            "Total Expense: ${formatCurrency(exp)}\n"
                            "Total Paid: ${formatCurrency(paid)}\n"
                            "*${isRec ? 'Receivable Amount' : 'Payable Amount'}:* ${formatCurrency(rem.abs())}\n"
                            "-----------------------------------\n"
                            "Date: ${DateFormat('dd/MM/yyyy').format(DateTime.now())}";

                        _shareWhatsApp(msg, mob?.toString());
                      },
                    ),
                  ],
                ],
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildReportContent() {
    if (_reportData == null) {
      return const Center(child: Text('No report data found'));
    }

    switch (_currentType) {
      case 'Total Expense Report':
        return _buildTotalExpenseView();
      case 'Paid by Person Report':
        return _buildPaidByPersonView();
      case 'Member Ledger Report':
        return _buildMemberLedgerView();
      case 'Detail Ledger Report':
        return _buildDetailLedgerView();
      case 'Day-Wise Expense Report':
        return _buildDayWiseView();
      case 'Group Summary & Settlement':
      default:
        return _buildGroupSummaryView();
    }
  }

  // 1. Group Summary & Settlement
  Widget _buildGroupSummaryView() {
    final balances = _reportData?['balances'] as List? ?? [];
    final settlements = _reportData?['settlements'] as List? ?? [];

    return ListView(
      padding: const EdgeInsets.all(12),
      children: [
        Card(
          color: Theme.of(context).colorScheme.primaryContainer,
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                _InfoCol('Total Expense', formatCurrency(_reportData?['totalExpense'] ?? 0)),
                _InfoCol('Total Paid', formatCurrency(_reportData?['totalPaid'] ?? 0)),
                _InfoCol('Members', '${_reportData?['totalMembers'] ?? 0}'),
              ],
            ),
          ),
        ),
        const SizedBox(height: 14),
        const Text('Member Balances', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
        const SizedBox(height: 8),
        ...balances.map((b) {
          final bal = double.tryParse(b['remainingBalance'].toString()) ?? 0;
          final pos = bal >= 0;
          return Card(
            margin: const EdgeInsets.only(bottom: 8),
            child: ListTile(
              leading: CircleAvatar(
                backgroundColor: pos ? Colors.green.withOpacity(0.15) : Colors.red.withOpacity(0.15),
                child: Text((b['personName'] as String)[0].toUpperCase(), style: TextStyle(color: pos ? Colors.green : Colors.red, fontWeight: FontWeight.bold)),
              ),
              title: Text(b['personName'] ?? '', style: const TextStyle(fontWeight: FontWeight.bold)),
              subtitle: Text('Paid: ${formatCurrency(b['totalPaid'])} • Share: ${formatCurrency(b['totalShare'])}', style: const TextStyle(fontSize: 12)),
              trailing: Container(
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
            ),
          );
        }),
        const SizedBox(height: 14),
        const Text('Settlement (Minimum Transactions)', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
        const SizedBox(height: 8),
        if (settlements.isEmpty)
          const Card(child: Padding(padding: EdgeInsets.all(16), child: Center(child: Text('Everyone is settled up!'))))
        else
          ...settlements.map((s) => Card(
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
              )),
      ],
    );
  }

  // 2. Total Expense Report
  Widget _buildTotalExpenseView() {
    final expenses = _reportData?['expenses'] as List? ?? [];
    return ListView(
      padding: const EdgeInsets.all(12),
      children: [
        Card(
          color: const Color(0xFF6366F1).withOpacity(0.1),
          elevation: 0,
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                _InfoCol('Transactions', '${_reportData?['totalTransactions'] ?? 0}'),
                _InfoCol('Total Expense', formatCurrency(_reportData?['totalExpense'] ?? 0)),
              ],
            ),
          ),
        ),
        const SizedBox(height: 10),
        ...expenses.map((e) => Card(
              margin: const EdgeInsets.only(bottom: 6),
              child: ListTile(
                title: Text(e['description'] ?? '', style: const TextStyle(fontWeight: FontWeight.w600)),
                subtitle: Text('${formatDate(e['date'])} • Paid by: ${e['paidByName'] ?? '-'}'),
                trailing: Text(formatCurrency(e['amount']), style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: Colors.indigo)),
              ),
            )),
      ],
    );
  }

  // 3. Paid by Person Report
  Widget _buildPaidByPersonView() {
    final totals = _reportData?['totals'] as List? ?? [];
    return ListView(
      padding: const EdgeInsets.all(12),
      children: [
        Card(
          color: const Color(0xFF10B981).withOpacity(0.1),
          elevation: 0,
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                _InfoCol('Members', '${_reportData?['totalMembers'] ?? 0}'),
                _InfoCol('Grand Total Paid', formatCurrency(_reportData?['grandTotal'] ?? 0)),
              ],
            ),
          ),
        ),
        const SizedBox(height: 10),
        ...totals.map((t) => Card(
              margin: const EdgeInsets.only(bottom: 8),
              child: ListTile(
                leading: CircleAvatar(child: Text((t['personName'] as String)[0].toUpperCase())),
                title: Text(t['personName'] ?? '', style: const TextStyle(fontWeight: FontWeight.bold)),
                trailing: Text(formatCurrency(t['totalPaid']), style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: Color(0xFF10B981))),
              ),
            )),
      ],
    );
  }

  // 4. Member Ledger Report
  Widget _buildMemberLedgerView() {
    final b = _reportData?['balance'];
    if (b == null) return const Center(child: Text('No ledger data found for this member'));

    final rem = double.tryParse(b['remainingBalance'].toString()) ?? 0;
    final isPos = rem >= 0;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text(b['personName'] ?? '', style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
        Text(b['mobileNumber']?.toString().isNotEmpty == true ? 'Mobile: ${b['mobileNumber']}' : 'No mobile registered', style: const TextStyle(color: Colors.grey)),
        const SizedBox(height: 16),
        Row(
          children: [
            Expanded(child: Card(child: Padding(padding: const EdgeInsets.all(14), child: _InfoCol('Total Paid', formatCurrency(b['totalPaid']))))),
            const SizedBox(width: 10),
            Expanded(child: Card(child: Padding(padding: const EdgeInsets.all(14), child: _InfoCol('Total Allocated', formatCurrency(b['totalShare']))))),
          ],
        ),
        const SizedBox(height: 16),
        Card(
          color: isPos ? Colors.green.withOpacity(0.12) : Colors.red.withOpacity(0.12),
          elevation: 0,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16), side: BorderSide(color: isPos ? Colors.green : Colors.red, width: 1.5)),
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              children: [
                Text(
                  isPos ? '▲ AMOUNT RECEIVABLE' : '▼ AMOUNT PAYABLE',
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: isPos ? Colors.green[800] : Colors.red[800]),
                ),
                const SizedBox(height: 10),
                Text(
                  formatCurrency(rem.abs()),
                  style: TextStyle(fontSize: 32, fontWeight: FontWeight.bold, color: isPos ? Colors.green[900] : Colors.red[900]),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  // 5. Detail Ledger Report
  Widget _buildDetailLedgerView() {
    final rows = _reportData?['rows'] as List? ?? [];
    final rem = double.tryParse((_reportData?['remainingBalance'] ?? 0).toString()) ?? 0;
    final isPos = rem >= 0;

    return ListView(
      padding: const EdgeInsets.all(12),
      children: [
        Row(
          children: [
            Expanded(child: Card(child: Padding(padding: const EdgeInsets.all(12), child: _InfoCol('Entries', '${_reportData?['totalEntries'] ?? 0}')))),
            const SizedBox(width: 8),
            Expanded(child: Card(child: Padding(padding: const EdgeInsets.all(12), child: _InfoCol('Your Expense', formatCurrency(_reportData?['yourTotalExpense'] ?? 0))))),
          ],
        ),
        const SizedBox(height: 10),
        ...rows.map((r) => Card(
              margin: const EdgeInsets.only(bottom: 6),
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(r['description'] ?? '', style: const TextStyle(fontWeight: FontWeight.bold)),
                          Text('${formatDate(r['date'])} • Total: ${formatCurrency(r['totalAmount'])} ÷ ${r['dividedByCount']}', style: const TextStyle(fontSize: 11, color: Colors.grey)),
                        ],
                      ),
                    ),
                    Text(formatCurrency(r['yourShare']), style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: Color(0xFF10B981))),
                  ],
                ),
              ),
            )),
        const Divider(height: 24),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 8),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text('Total Expense: ${formatCurrency(_reportData?['yourTotalExpense'] ?? 0)}', style: const TextStyle(fontSize: 13)),
              Text('Total Paid: ${formatCurrency(_reportData?['totalPaid'] ?? 0)}', style: const TextStyle(fontSize: 13)),
              const SizedBox(height: 4),
              Text(
                '${isPos ? "Receivable" : "Payable"}: ${formatCurrency(rem.abs())}',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: isPos ? Colors.green : Colors.red),
              ),
            ],
          ),
        ),
      ],
    );
  }

  // 6. Day-Wise Expense Report
  Widget _buildDayWiseView() {
    final groups = _reportData?['groups'] as List? ?? [];
    return ListView(
      padding: const EdgeInsets.all(12),
      children: [
        Card(
          color: const Color(0xFF6366F1).withOpacity(0.1),
          elevation: 0,
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                _InfoCol('Days With Data', '${_reportData?['daysWithData'] ?? 0}'),
                _InfoCol('Grand Total', formatCurrency(_reportData?['grandTotal'] ?? 0)),
              ],
            ),
          ),
        ),
        const SizedBox(height: 10),
        if (groups.isEmpty)
          const Padding(padding: EdgeInsets.all(20), child: Center(child: Text('No tagged expenses found in date range.')))
        else
          ...groups.map((g) {
            final categories = g['categories'] as List? ?? [];
            return Card(
              margin: const EdgeInsets.only(bottom: 12),
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(formatDate(g['dateMillis']), style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                        Text('Day Total: ${formatCurrency(g['dayTotal'])}', style: const TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF6366F1))),
                      ],
                    ),
                    const Divider(height: 16),
                    ...categories.map((c) => Padding(
                          padding: const EdgeInsets.symmetric(vertical: 4),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(c['category'] ?? '', style: const TextStyle(fontWeight: FontWeight.w600)),
                              Text(
                                '${formatCurrency(c['totalAmount'])} ÷ ${c['effectivePersons']} = ${formatCurrency(c['calculatedShare'])}',
                                style: const TextStyle(fontSize: 12, color: Color(0xFF10B981)),
                              ),
                            ],
                          ),
                        )),
                  ],
                ),
              ),
            );
          }),
      ],
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
          const Divider(height: 32),

          ListTile(
            leading: const Icon(Icons.logout, color: Colors.red),
            title: const Text('Logout', style: TextStyle(color: Colors.red, fontWeight: FontWeight.bold)),
            onTap: () async {
              final confirm = await showDialog<bool>(
                context: context,
                builder: (ctx) => AlertDialog(
                  title: const Text('Confirm Logout'),
                  content: const Text('Do you want to log out of your account?'),
                  actions: [
                    TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
                    ElevatedButton(
                      style: ElevatedButton.styleFrom(backgroundColor: Colors.red, foregroundColor: Colors.white),
                      onPressed: () => Navigator.pop(ctx, true),
                      child: const Text('Logout'),
                    ),
                  ],
                ),
              );
              if (confirm == true && mounted) {
                Navigator.pushAndRemoveUntil(
                  context,
                  MaterialPageRoute(
                    builder: (_) => LoginPage(
                      serverUrl: widget.api.baseUrl,
                      onServerUrlChanged: (_) {},
                      onThemeChanged: widget.onThemeChanged,
                      themeMode: widget.themeMode,
                    ),
                  ),
                  (route) => false,
                );
              }
            },
          ),
        ],
      ),
    );
  }
}
