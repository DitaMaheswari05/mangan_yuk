const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const NETWORK_SECURITY_CONFIG = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <!-- Nonaktifkan cleartext traffic secara global di production, tetapi izinkan localhost/10.0.2.2 untuk Metro Bundler saat development -->
    <base-config cleartextTrafficPermitted="false">
        <trust-anchors>
            <certificates src="system" />
        </trust-anchors>
    </base-config>
    <domain-config cleartextTrafficPermitted="true">
        <domain includeSubdomains="true">localhost</domain>
        <domain includeSubdomains="true">10.0.2.2</domain>
        <domain includeSubdomains="true">127.0.0.1</domain>
    </domain-config>
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
  config = withAndroidManifest(config, (config) => {
    const mainApplication = config.modResults.manifest.application?.[0];
    if (mainApplication) {
      mainApplication.$['android:networkSecurityConfig'] = '@xml/network_security_config';
      mainApplication.$['android:usesCleartextTraffic'] = 'true';
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
