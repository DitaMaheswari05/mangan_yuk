const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const NETWORK_SECURITY_CONFIG = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <!-- OWASP M5 & M8: Nonaktifkan cleartext traffic (HTTP) secara global -->
    <base-config cleartextTrafficPermitted="false">
        <trust-anchors>
            <!-- Hanya percaya CA tersertifikasi oleh sistem Android (menolak user-installed CA di production) -->
            <certificates src="system" />
        </trust-anchors>
    </base-config>
    <!-- Domain konfigurasi spesifik untuk layanan yang digunakan -->
    <domain-config cleartextTrafficPermitted="false">
        <domain includeSubdomains="true">openstreetmap.org</domain>
        <domain includeSubdomains="true">openstreetmap.de</domain>
        <domain includeSubdomains="true">supabase.co</domain>
        <trust-anchors>
            <certificates src="system" />
        </trust-anchors>
    </domain-config>
</network-security-config>
`;

function withNetworkSecurityConfig(config) {
  // 1. Modifikasi AndroidManifest.xml:
  // - android:networkSecurityConfig
  // - android:usesCleartextTraffic="false"
  // - android:allowBackup="false"
  config = withAndroidManifest(config, (config) => {
    const mainApplication = config.modResults.manifest.application?.[0];
    if (mainApplication) {
      mainApplication.$['android:networkSecurityConfig'] = '@xml/network_security_config';
      mainApplication.$['android:usesCleartextTraffic'] = 'false';
      mainApplication.$['android:allowBackup'] = 'false';
    }
    return config;
  });

  // 2. Buat file res/xml/network_security_config.xml saat prebuild
  config = withDangerousMod(config, [
    'android',
    async (config) => {
      const resXmlDir = path.join(
        config.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'res',
        'xml',
      );
      if (!fs.existsSync(resXmlDir)) {
        fs.mkdirSync(resXmlDir, { recursive: true });
      }
      fs.writeFileSync(
        path.join(resXmlDir, 'network_security_config.xml'),
        NETWORK_SECURITY_CONFIG.trim(),
        'utf-8',
      );
      return config;
    },
  ]);

  return config;
}

module.exports = withNetworkSecurityConfig;
