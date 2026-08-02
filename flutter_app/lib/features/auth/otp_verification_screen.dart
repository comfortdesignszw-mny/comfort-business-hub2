import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'password_reset_providers.dart';

/// Phone OTP Verification & Password Reset Screen
class OtpVerificationScreen extends ConsumerStatefulWidget {
  final String phoneNumber;
  final String? verificationId;

  const OtpVerificationScreen({
    Key? key,
    required this.phoneNumber,
    this.verificationId,
  }) : super(key: key);

  @override
  ConsumerState<OtpVerificationScreen> createState() => _OtpVerificationScreenState();
}

class _OtpVerificationScreenState extends ConsumerState<OtpVerificationScreen> {
  final _formKey = GlobalKey<FormState>();
  final _otpController = TextEditingController();
  final _newPasswordController = TextEditingController();
  bool _obscure = true;

  @override
  void dispose() {
    _otpController.dispose();
    _newPasswordController.dispose();
    super.dispose();
  }

  void _handleVerifyAndReset() async {
    if (!_formKey.currentState!.validate()) return;

    // Simulate or pass ID token from SMS verification
    final dummyOrRealToken = "phone_verified_${_otpController.text.trim()}_${DateTime.now().millisecondsSinceEpoch}";
    
    final success = await ref.read(passwordResetProvider.notifier).resetPasswordPhoneOTP(
      idToken: dummyOrRealToken,
      newPassword: _newPasswordController.text,
    );

    if (success && mounted) {
      Navigator.of(context).pushReplacementNamed('/reset-success');
    }
  }

  @override
  Widget build(BuildContext context) {
    final resetState = ref.watch(passwordResetProvider);

    return Scaffold(
      backgroundColor: const Color(0xFF05070A),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: const Text('Verify Phone Code', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                'Enter SMS Code for ${widget.phoneNumber}',
                style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              const Text(
                'Enter the 6-digit verification code sent to your mobile device along with your new password.',
                style: TextStyle(color: Colors.grey, fontSize: 14),
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
                    TextFormField(
                      controller: _otpController,
                      keyboardType: TextInputType.number,
                      style: const TextStyle(color: Colors.white, letterSpacing: 4, fontWeight: FontWeight.bold, fontSize: 18),
                      decoration: InputDecoration(
                        labelText: '6-Digit SMS Code',
                        labelStyle: const TextStyle(color: Colors.grey, letterSpacing: 0),
                        prefixIcon: const Icon(Icons.pin, color: Color(0xFF00F2FE)),
                        filled: true,
                        fillColor: const Color(0xFF0F172A),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                      ),
                      validator: (v) {
                        if (v == null || v.trim().length < 6) return 'Please enter 6-digit OTP code';
                        return null;
                      },
                    ),
                    const SizedBox(height: 20),

                    TextFormField(
                      controller: _newPasswordController,
                      obscureText: _obscure,
                      style: const TextStyle(color: Colors.white),
                      decoration: InputDecoration(
                        labelText: 'New Password',
                        labelStyle: const TextStyle(color: Colors.grey),
                        prefixIcon: const Icon(Icons.lock_outline, color: Color(0xFF00F2FE)),
                        suffixIcon: IconButton(
                          icon: Icon(_obscure ? Icons.visibility_off : Icons.visibility, color: Colors.grey),
                          onPressed: () => setState(() => _obscure = !_obscure),
                        ),
                        filled: true,
                        fillColor: const Color(0xFF0F172A),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                      ),
                      validator: (v) {
                        if (v == null || v.length < 8) return 'Password must be at least 8 characters';
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
                        onPressed: resetState.isLoading ? null : _handleVerifyAndReset,
                        child: resetState.isLoading
                            ? const CircularProgressIndicator(color: Colors.black)
                            : const Text('Verify & Reset Password', style: TextStyle(color: Colors.black, fontWeight: FontWeight.bold, fontSize: 16)),
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
