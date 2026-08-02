import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'password_reset_providers.dart';

/// Forgot Password Screen (Comfort Business Hub)
/// Supports Email vs Phone password reset selection with anti-enumeration protection.
class ForgotPasswordScreen extends ConsumerStatefulWidget {
  const ForgotPasswordScreen({Key? key}) : super(key: key);

  @override
  ConsumerState<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends ConsumerState<ForgotPasswordScreen> {
  final _formKey = GlobalKey<FormState>();
  final _identifierController = TextEditingController();

  @override
  void dispose() {
    _identifierController.dispose();
    super.dispose();
  }

  void _handleSubmit() {
    if (!_formKey.currentState!.validate()) return;
    
    final state = ref.read(passwordResetProvider);
    final input = _identifierController.text.trim();

    if (state.mode == PasswordResetMode.email) {
      ref.read(passwordResetProvider.notifier).requestEmailReset(input);
    } else {
      ref.read(passwordResetProvider.notifier).requestPhoneReset(input);
    }
  }

  @override
  Widget build(BuildContext context) {
    final resetState = ref.watch(passwordResetProvider);
    final isEmail = resetState.mode == PasswordResetMode.email;

    return Scaffold(
      backgroundColor: const Color(0xFF05070A),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: const Text('Reset Password', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.white),
          onPressed: () => Navigator.of(context).pop(),
        ),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Comfort Business Hub Header Badge
              Center(
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  decoration: BoxDecoration(
                    color: const Color(0xFF00F2FE).withOpacity(0.1),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: const Color(0xFF00F2FE).withOpacity(0.3)),
                  ),
                  child: const Text(
                    'COMFORT BUSINESS HUB',
                    style: TextStyle(
                      color: Color(0xFF00F2FE),
                      fontWeight: FontWeight.w900,
                      fontSize: 12,
                      letterSpacing: 1.2,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 24),

              const Text(
                'Account Recovery',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: Colors.white),
              ),
              const SizedBox(height: 8),
              const Text(
                'Enter your registered email address or phone number to receive a secure password reset link or OTP verification code.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 14, color: Colors.grey),
              ),
              const SizedBox(height: 32),

              // Mode Switcher (Email vs Phone Tab)
              Container(
                decoration: BoxDecoration(
                  color: const Color(0xFF0F172A),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.white12),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: GestureDetector(
                        onTap: () {
                          ref.read(passwordResetProvider.notifier).setMode(PasswordResetMode.email);
                          _identifierController.clear();
                        },
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 200),
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          decoration: BoxDecoration(
                            color: isEmail ? const Color(0xFF00F2FE) : Colors.transparent,
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Text(
                            'Email Address',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              color: isEmail ? Colors.black : Colors.white70,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                      ),
                    ),
                    Expanded(
                      child: GestureDetector(
                        onTap: () {
                          ref.read(passwordResetProvider.notifier).setMode(PasswordResetMode.phone);
                          _identifierController.clear();
                        },
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 200),
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          decoration: BoxDecoration(
                            color: !isEmail ? const Color(0xFF00F2FE) : Colors.transparent,
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Text(
                            'Phone Number',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              color: !isEmail ? Colors.black : Colors.white70,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),

              // Generic Success Feedback (Anti-enumeration)
              if (resetState.successMessage != null)
                Container(
                  padding: const EdgeInsets.all(16),
                  margin: const EdgeInsets.only(bottom: 24),
                  decoration: BoxDecoration(
                    color: const Color(0xFF10B981).withOpacity(0.1),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFF10B981).withOpacity(0.3)),
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Icon(Icons.check_circle_outline, color: Color(0xFF10B981)),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          resetState.successMessage!,
                          style: const TextStyle(color: Colors.white, fontSize: 13, height: 1.4),
                        ),
                      ),
                    ],
                  ),
                ),

              if (resetState.errorMessage != null)
                Container(
                  padding: const EdgeInsets.all(16),
                  margin: const EdgeInsets.only(bottom: 24),
                  decoration: BoxDecoration(
                    color: Colors.red.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.red.withOpacity(0.3)),
                  ),
                  child: Text(
                    resetState.errorMessage!,
                    style: const TextStyle(color: Colors.redAccent, fontSize: 13),
                  ),
                ),

              // Reset Form
              Form(
                key: _formKey,
                child: Column(
                  children: [
                    TextFormField(
                      controller: _identifierController,
                      style: const TextStyle(color: Colors.white),
                      keyboardType: isEmail ? TextInputType.emailAddress : TextInputType.phone,
                      decoration: InputDecoration(
                        labelText: isEmail ? 'Email Address' : 'Phone Number (e.g. +263771234567)',
                        labelStyle: const TextStyle(color: Colors.grey),
                        prefixIcon: Icon(isEmail ? Icons.email_outlined : Icons.phone_android, color: const Color(0xFF00F2FE)),
                        filled: true,
                        fillColor: const Color(0xFF0F172A),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: const BorderSide(color: Color(0xFF00F2FE)),
                        ),
                      ),
                      validator: (value) {
                        if (value == null || value.trim().isEmpty) {
                          return isEmail ? 'Please enter your email' : 'Please enter your phone number';
                        }
                        if (isEmail && !value.contains('@')) {
                          return 'Please enter a valid email address';
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: 24),

                    SizedBox(
                      width: double.infinity,
                      height: 50,
                      child: ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF00F2FE),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                        onPressed: resetState.isLoading ? null : _handleSubmit,
                        child: resetState.isLoading
                            ? const SizedBox(
                                width: 24,
                                height: 24,
                                child: CircularProgressIndicator(color: Colors.black, strokeWidth: 2),
                              )
                            : Text(
                                isEmail ? 'Send Reset Link' : 'Send OTP Code',
                                style: const TextStyle(color: Colors.black, fontWeight: FontWeight.bold, fontSize: 16),
                              ),
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
