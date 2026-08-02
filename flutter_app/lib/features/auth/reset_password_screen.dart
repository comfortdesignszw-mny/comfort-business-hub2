import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'password_reset_providers.dart';

/// Reset Password Screen (Email Deep Link Entry)
/// Captures raw token and uid, enforces password strength rules, and submits reset request.
class ResetPasswordScreen extends ConsumerStatefulWidget {
  final String token;
  final String uid;

  const ResetPasswordScreen({
    Key? key,
    required this.token,
    required this.uid,
  }) : super(key: key);

  @override
  ConsumerState<ResetPasswordScreen> createState() => _ResetPasswordScreenState();
}

class _ResetPasswordScreenState extends ConsumerState<ResetPasswordScreen> {
  final _formKey = GlobalKey<FormState>();
  final _passController = TextEditingController();
  final _confirmPassController = TextEditingController();
  
  bool _obscurePassword = true;
  bool _obscureConfirm = true;

  @override
  void dispose() {
    _passController.dispose();
    _confirmPassController.dispose();
    super.dispose();
  }

  double _calculatePasswordStrength(String password) {
    if (password.isEmpty) return 0.0;
    double score = 0.0;
    if (password.length >= 8) score += 0.3;
    if (password.length >= 12) score += 0.2;
    if (RegExp(r'[A-Z]').hasMatch(password)) score += 0.2;
    if (RegExp(r'[0-9]').hasMatch(password)) score += 0.15;
    if (RegExp(r'[!@#$%^&*(),.?":{}|<>]').hasMatch(password)) score += 0.15;
    return score.clamp(0.0, 1.0);
  }

  Color _getStrengthColor(double strength) {
    if (strength < 0.4) return Colors.red;
    if (strength < 0.7) return Colors.amber;
    return const Color(0xFF10B981);
  }

  void _handleReset() async {
    if (!_formKey.currentState!.validate()) return;

    final success = await ref.read(passwordResetProvider.notifier).resetPasswordWithToken(
      token: widget.token,
      uid: widget.uid,
      newPassword: _passController.text,
    );

    if (success && mounted) {
      Navigator.of(context).pushReplacementNamed('/reset-success');
    }
  }

  @override
  Widget build(BuildContext context) {
    final resetState = ref.watch(passwordResetProvider);
    final strength = _calculatePasswordStrength(_passController.text);

    return Scaffold(
      backgroundColor: const Color(0xFF05070A),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: const Text('Create New Password', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text(
                'Set Your New Password',
                style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: Colors.white),
              ),
              const SizedBox(height: 8),
              const Text(
                'Please enter a strong password containing at least 8 characters, numbers, and symbols.',
                style: TextStyle(fontSize: 14, color: Colors.grey),
              ),
              const SizedBox(height: 24),

              if (resetState.errorMessage != null)
                Container(
                  padding: const EdgeInsets.all(14),
                  margin: const EdgeInsets.only(bottom: 20),
                  decoration: BoxDecoration(
                    color: Colors.red.withOpacity(0.12),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: Colors.red.withOpacity(0.3)),
                  ),
                  child: Text(resetState.errorMessage!, style: const TextStyle(color: Colors.redAccent, fontSize: 13)),
                ),

              Form(
                key: _formKey,
                child: Column(
                  children: [
                    // New Password Field
                    TextFormField(
                      controller: _passController,
                      obscureText: _obscurePassword,
                      style: const TextStyle(color: Colors.white),
                      onChanged: (_) => setState(() {}),
                      decoration: InputDecoration(
                        labelText: 'New Password',
                        labelStyle: const TextStyle(color: Colors.grey),
                        prefixIcon: const Icon(Icons.lock_outline, color: Color(0xFF00F2FE)),
                        suffixIcon: IconButton(
                          icon: Icon(_obscurePassword ? Icons.visibility_off : Icons.visibility, color: Colors.grey),
                          onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
                        ),
                        filled: true,
                        fillColor: const Color(0xFF0F172A),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                      ),
                      validator: (v) {
                        if (v == null || v.isEmpty) return 'Password is required';
                        if (v.length < 8) return 'Minimum 8 characters required';
                        return null;
                      },
                    ),
                    const SizedBox(height: 12),

                    // Password Strength Indicator
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        ClipRRect(
                          borderRadius: BorderRadius.circular(4),
                          child: LinearProgressIndicator(
                            value: strength,
                            backgroundColor: Colors.white12,
                            valueColor: AlwaysStoppedAnimation<Color>(_getStrengthColor(strength)),
                            minHeight: 6,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              strength < 0.4 ? 'Weak' : (strength < 0.7 ? 'Moderate' : 'Strong'),
                              style: TextStyle(color: _getStrengthColor(strength), fontSize: 12, fontWeight: FontWeight.bold),
                            ),
                            const Text('Must be 8+ chars', style: TextStyle(color: Colors.grey, fontSize: 11)),
                          ],
                        ),
                      ],
                    ),
                    const SizedBox(height: 20),

                    // Confirm Password Field
                    TextFormField(
                      controller: _confirmPassController,
                      obscureText: _obscureConfirm,
                      style: const TextStyle(color: Colors.white),
                      decoration: InputDecoration(
                        labelText: 'Confirm Password',
                        labelStyle: const TextStyle(color: Colors.grey),
                        prefixIcon: const Icon(Icons.lock_reset, color: Color(0xFF00F2FE)),
                        suffixIcon: IconButton(
                          icon: Icon(_obscureConfirm ? Icons.visibility_off : Icons.visibility, color: Colors.grey),
                          onPressed: () => setState(() => _obscureConfirm = !_obscureConfirm),
                        ),
                        filled: true,
                        fillColor: const Color(0xFF0F172A),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                      ),
                      validator: (v) {
                        if (v != _passController.text) return 'Passwords do not match';
                        return null;
                      },
                    ),
                    const SizedBox(height: 30),

                    SizedBox(
                      width: double.infinity,
                      height: 50,
                      child: ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF00F2FE),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                        onPressed: resetState.isLoading ? null : _handleReset,
                        child: resetState.isLoading
                            ? const CircularProgressIndicator(color: Colors.black)
                            : const Text('Update Password', style: TextStyle(color: Colors.black, fontWeight: FontWeight.bold, fontSize: 16)),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
