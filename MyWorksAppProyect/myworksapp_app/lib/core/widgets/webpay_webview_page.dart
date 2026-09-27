import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

import '../theme/app_colors.dart';

/// Resultado de una sesión Webpay embebida.
class WebpayCheckoutResult {
  const WebpayCheckoutResult({
    this.tokenWs,
    this.approved,
    this.aborted = false,
  });

  final String? tokenWs;
  final bool? approved;
  final bool aborted;
}

/// WebView in-app para Webpay: el usuario no sale a Chrome/Safari externo.
class WebpayWebViewPage extends StatefulWidget {
  const WebpayWebViewPage({
    super.key,
    required this.paymentUrl,
    this.tokenWs,
    this.captureReturn = false,
    this.title = 'Pago Webpay',
  });

  final String paymentUrl;
  final String? tokenWs;
  final bool captureReturn;
  final String title;

  /// Abre la URL de handoff y espera retorno (deep link o post-commit).
  static Future<bool> open(BuildContext context, {required String paymentUrl}) async {
    final result = await Navigator.of(context).push<Object?>(
      MaterialPageRoute(
        fullscreenDialog: true,
        builder: (_) => WebpayWebViewPage(paymentUrl: paymentUrl),
      ),
    );
    if (result is WebpayCheckoutResult) {
      return result.approved != false && !result.aborted;
    }
    return result == true;
  }

  /// POST `token_ws` al comercio y devuelve el token del retorno.
  static Future<WebpayCheckoutResult?> openCheckout(
    BuildContext context, {
    required String paymentUrl,
    required String tokenWs,
  }) {
    return Navigator.of(context).push<WebpayCheckoutResult>(
      MaterialPageRoute(
        fullscreenDialog: true,
        builder: (_) => WebpayWebViewPage(
          paymentUrl: paymentUrl,
          tokenWs: tokenWs,
          captureReturn: true,
        ),
      ),
    );
  }

  @override
  State<WebpayWebViewPage> createState() => _WebpayWebViewPageState();
}

class _WebpayWebViewPageState extends State<WebpayWebViewPage> {
  late final WebViewController _controller;
  var _loading = true;
  var _closed = false;

  bool _isReturnUrl(String url) {
    final lower = url.toLowerCase();
    if (lower.contains('webpay-commit')) return false;
    return lower.startsWith('myworksapp://payment-result') ||
        lower.startsWith('myworksapp://pago') ||
        lower.contains('/payment-result') ||
        lower.contains('pago=ok') ||
        lower.contains('pago=fail') ||
        lower.contains('pago=retorno') ||
        lower.contains('/pago/retorno');
  }

  bool _isApprovedReturn(String url) {
    final lower = url.toLowerCase();
    if (lower.contains('approved=0') ||
        lower.contains('ok=0') ||
        lower.contains('pago=fail')) {
      return false;
    }
    if (lower.contains('approved=1') ||
        lower.contains('ok=1') ||
        lower.contains('pago=ok')) {
      return true;
    }
    return lower.contains('pago=retorno');
  }

  String? _tokenFrom(String url) {
    final uri = Uri.tryParse(url);
    if (uri == null) return null;
    final token = uri.queryParameters['token_ws'] ?? uri.queryParameters['token'];
    if (token == null || token.isEmpty) return null;
    return token;
  }

  void _finish(String url) {
    if (!mounted || _closed) return;
    _closed = true;
    final approved = _isApprovedReturn(url);
    if (widget.captureReturn) {
      Navigator.of(context).pop(
        WebpayCheckoutResult(
          tokenWs: _tokenFrom(url) ?? widget.tokenWs,
          approved: approved,
          aborted: url.toLowerCase().contains('tbk_token') &&
              _tokenFrom(url) == null,
        ),
      );
      return;
    }
    Navigator.of(context).pop(approved);
  }

  @override
  void initState() {
    super.initState();
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageStarted: (_) {
            if (mounted) setState(() => _loading = true);
          },
          onPageFinished: (_) {
            if (mounted) setState(() => _loading = false);
          },
          onNavigationRequest: (request) {
            final url = request.url;
            if (_isReturnUrl(url)) {
              _finish(url);
              return NavigationDecision.prevent;
            }
            return NavigationDecision.navigate;
          },
          onUrlChange: (change) {
            final url = change.url;
            if (url == null) return;
            if (_isReturnUrl(url)) {
              _finish(url);
            }
          },
        ),
      );

    final token = widget.tokenWs;
    if (token != null && token.isNotEmpty) {
      _controller.loadRequest(
        Uri.parse(widget.paymentUrl),
        method: LoadRequestMethod.post,
        headers: const {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: utf8.encode('token_ws=${Uri.encodeQueryComponent(token)}'),
      );
    } else {
      _controller.loadRequest(Uri.parse(widget.paymentUrl));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.title),
        backgroundColor: AppColors.brandNavy,
        foregroundColor: Colors.white,
        actions: [
          IconButton(
            tooltip: 'Cancelar',
            onPressed: () {
              if (widget.captureReturn) {
                Navigator.of(context).pop(null);
              } else {
                Navigator.of(context).pop(false);
              }
            },
            icon: const Icon(Icons.close),
          ),
        ],
      ),
      body: Stack(
        children: [
          WebViewWidget(controller: _controller),
          if (_loading)
            const LinearProgressIndicator(
              minHeight: 3,
              color: AppColors.brandOrange,
            ),
        ],
      ),
    );
  }
}
