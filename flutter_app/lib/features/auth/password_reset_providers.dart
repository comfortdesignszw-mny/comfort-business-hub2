import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'password_reset_service.dart';

enum PasswordResetMode { email, phone }

class PasswordResetState {
  final bool isLoading;
  final String? errorMessage;
  final String? successMessage;
  final PasswordResetMode mode;
  final String? verificationId;
  final String? phoneIdToken;
  final bool isCompleted;

  const PasswordResetState({
    this.isLoading = false,
    this.errorMessage,
    this.successMessage,
    this.mode = PasswordResetMode.email,
    this.verificationId,
    this.phoneIdToken,
    this.isCompleted = false,
  });

  PasswordResetState copyWith({
    bool? isLoading,
    String? errorMessage,
    String? successMessage,
    PasswordResetMode? mode,
    String? verificationId,
    String? phoneIdToken,
    bool? isCompleted,
  }) {
    return PasswordResetState(
      isLoading: isLoading ?? this.isLoading,
      errorMessage: errorMessage,
      successMessage: successMessage ?? this.successMessage,
      mode: mode ?? this.mode,
      verificationId: verificationId ?? this.verificationId,
      phoneIdToken: phoneIdToken ?? this.phoneIdToken,
      isCompleted: isCompleted ?? this.isCompleted,
    );
  }
}

final passwordResetServiceProvider = Provider<PasswordResetService>((ref) {
  return PasswordResetService();
});

class PasswordResetNotifier extends StateNotifier<PasswordResetState> {
  final PasswordResetService _service;

  PasswordResetNotifier(this._service) : super(const PasswordResetState());

  void setMode(PasswordResetMode mode) {
    state = state.copyWith(mode: mode, errorMessage: null, successMessage: null);
  }

  Future<void> requestEmailReset(String email) async {
    state = state.copyWith(isLoading: true, errorMessage: null, successMessage: null);
    
    final res = await _service.requestEmailPasswordReset(email);
    
    if (res['success'] == true) {
      state = state.copyWith(
        isLoading: false,
        successMessage: res['message'] ?? "If that email is registered, we've sent you a reset link.",
      );
    } else {
      state = state.copyWith(
        isLoading: false,
        errorMessage: res['message'] ?? 'Failed to request password reset.',
      );
    }
  }

  Future<void> requestPhoneReset(String phone) async {
    state = state.copyWith(isLoading: true, errorMessage: null, successMessage: null);
    
    final res = await _service.requestPhonePasswordReset(phone);
    
    if (res['success'] == true) {
      state = state.copyWith(
        isLoading: false,
        successMessage: res['message'] ?? "If that phone number is registered, an OTP code has been dispatched.",
      );
    } else {
      state = state.copyWith(
        isLoading: false,
        errorMessage: res['message'] ?? 'Failed to request phone password reset.',
      );
    }
  }

  Future<bool> resetPasswordWithToken({
    required String token,
    required String uid,
    required String newPassword,
  }) async {
    state = state.copyWith(isLoading: true, errorMessage: null, successMessage: null);

    final res = await _service.resetPasswordWithToken(
      token: token,
      uid: uid,
      newPassword: newPassword,
    );

    if (res['success'] == true) {
      state = state.copyWith(
        isLoading: false,
        isCompleted: true,
        successMessage: res['message'] ?? 'Password reset successfully.',
      );
      return true;
    } else {
      state = state.copyWith(
        isLoading: false,
        errorMessage: res['message'] ?? 'Failed to reset password.',
      );
      return false;
    }
  }

  Future<bool> resetPasswordPhoneOTP({
    required String idToken,
    required String newPassword,
  }) async {
    state = state.copyWith(isLoading: true, errorMessage: null, successMessage: null);

    final res = await _service.resetPasswordAfterPhoneOTP(
      idToken: idToken,
      newPassword: newPassword,
    );

    if (res['success'] == true) {
      state = state.copyWith(
        isLoading: false,
        isCompleted: true,
        successMessage: res['message'] ?? 'Password reset successfully.',
      );
      return true;
    } else {
      state = state.copyWith(
        isLoading: false,
        errorMessage: res['message'] ?? 'Failed to reset password with phone OTP.',
      );
      return false;
    }
  }
}

final passwordResetProvider = StateNotifierProvider<PasswordResetNotifier, PasswordResetState>((ref) {
  final service = ref.watch(passwordResetServiceProvider);
  return PasswordResetNotifier(service);
});
