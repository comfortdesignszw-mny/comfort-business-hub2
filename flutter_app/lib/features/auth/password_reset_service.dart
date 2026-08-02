import 'package:cloud_functions/cloud_functions.dart';
import 'package:firebase_auth/firebase_auth.dart';

/// PasswordResetService communicates with Comfort Business Hub Cloud Functions
/// and Firebase Phone Auth for custom password reset flows.
class PasswordResetService {
  final FirebaseFunctions _functions;
  final FirebaseAuth _auth;

  PasswordResetService({
    FirebaseFunctions? functions,
    FirebaseAuth? auth,
  })  : _functions = functions ?? FirebaseFunctions.instance,
        _auth = auth ?? FirebaseAuth.instance;

  /// Request password reset link for email
  Future<Map<String, dynamic>> requestEmailPasswordReset(String email, {String? appDomain}) async {
    try {
      final HttpsCallable callable = _functions.httpsCallable('requestPasswordReset');
      final result = await callable.call(<String, dynamic>{
        'email': email.trim().toLowerCase(),
        if (appDomain != null) 'appDomain': appDomain,
      });
      return Map<String, dynamic>.from(result.data as Map);
    } catch (e) {
      // Security Requirement: Return generic success on generic function call to prevent client leaks
      return {
        'success': true,
        'message': "If that email/phone number is registered, we've sent you a reset link/code.",
      };
    }
  }

  /// Execute password reset using email token and uid
  Future<Map<String, dynamic>> resetPasswordWithToken({
    required String token,
    required String uid,
    required String newPassword,
  }) async {
    try {
      final HttpsCallable callable = _functions.httpsCallable('resetPassword');
      final result = await callable.call(<String, dynamic>{
        'token': token,
        'uid': uid,
        'newPassword': newPassword,
      });
      return Map<String, dynamic>.from(result.data as Map);
    } catch (e) {
      return {
        'success': false,
        'message': 'Failed to reset password. Link may be invalid or expired.',
      };
    }
  }

  /// Request phone password reset
  Future<Map<String, dynamic>> requestPhonePasswordReset(String phoneNumber) async {
    try {
      final HttpsCallable callable = _functions.httpsCallable('requestPasswordResetPhone');
      final result = await callable.call(<String, dynamic>{
        'phone': phoneNumber.trim(),
      });
      return Map<String, dynamic>.from(result.data as Map);
    } catch (e) {
      return {
        'success': true,
        'message': "If that email/phone number is registered, we've sent you a reset link/code.",
      };
    }
  }

  /// Verify phone OTP and trigger phone password reset
  Future<Map<String, dynamic>> resetPasswordAfterPhoneOTP({
    required String idToken,
    required String newPassword,
  }) async {
    try {
      final HttpsCallable callable = _functions.httpsCallable('resetPasswordAfterPhoneVerification');
      final result = await callable.call(<String, dynamic>{
        'idToken': idToken,
        'newPassword': newPassword,
      });
      return Map<String, dynamic>.from(result.data as Map);
    } catch (e) {
      return {
        'success': false,
        'message': 'Phone verification failed or expired.',
      };
    }
  }
}
