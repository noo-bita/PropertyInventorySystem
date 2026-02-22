<?php
/**
 * PHP Info Diagnostic File
 * 
 * This file helps diagnose PHP configuration issues.
 * Access it via: http://127.0.0.1:8000/phpinfo.php
 * 
 * IMPORTANT: Delete this file after diagnosing the issue for security.
 */

// Check ZipArchive extension
$zipLoaded = extension_loaded('zip');
$phpIniLoaded = php_ini_loaded_file();
$phpIniScanned = php_ini_scanned_files();

echo "<h1>PHP Configuration Diagnostic</h1>";
echo "<h2>ZipArchive Extension Status</h2>";
echo "<p><strong>Status:</strong> " . ($zipLoaded ? '<span style="color: green;">ENABLED ✓</span>' : '<span style="color: red;">DISABLED ✗</span>') . "</p>";

if (!$zipLoaded) {
    echo "<div style='background: #ffebee; padding: 15px; border-left: 4px solid #f44336; margin: 10px 0;'>";
    echo "<h3>⚠️ ZipArchive Extension is NOT Loaded</h3>";
    echo "<p><strong>Solution:</strong></p>";
    echo "<ol>";
    echo "<li>Open: <code>" . $phpIniLoaded . "</code></li>";
    echo "<li>Find the line: <code>;extension=zip</code></li>";
    echo "<li>Remove the semicolon: <code>extension=zip</code></li>";
    echo "<li>Save the file</li>";
    echo "<li><strong>Restart Apache in XAMPP Control Panel</strong></li>";
    echo "</ol>";
    echo "</div>";
}

echo "<h2>PHP Configuration Files</h2>";
echo "<p><strong>Loaded php.ini:</strong> <code>" . ($phpIniLoaded ?: 'Not found') . "</code></p>";
echo "<p><strong>Scanned php.ini:</strong> <code>" . ($phpIniScanned ?: 'None') . "</code></p>";

echo "<h2>Loaded Extensions</h2>";
$extensions = get_loaded_extensions();
sort($extensions);
echo "<p>Total: " . count($extensions) . " extensions</p>";
echo "<ul>";
foreach ($extensions as $ext) {
    $highlight = ($ext === 'zip') ? ' style="background: #c8e6c9; padding: 2px 5px; border-radius: 3px;"' : '';
    echo "<li{$highlight}>{$ext}</li>";
}
echo "</ul>";

echo "<h2>Full PHP Info</h2>";
echo "<p><a href='?full=1'>Click here to view full phpinfo()</a></p>";

if (isset($_GET['full']) && $_GET['full'] == '1') {
    phpinfo();
}
?>

