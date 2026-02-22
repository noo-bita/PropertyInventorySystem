<?php
/**
 * Quick ZipArchive Extension Check
 * 
 * Access via: http://127.0.0.1:8000/check-zip.php
 * 
 * This will show if the ZipArchive extension is loaded in Apache's PHP.
 */

header('Content-Type: application/json');

$zipLoaded = extension_loaded('zip');
$phpIniLoaded = php_ini_loaded_file();
$phpVersion = PHP_VERSION;

$result = [
    'zip_extension_loaded' => $zipLoaded,
    'php_version' => $phpVersion,
    'php_ini_file' => $phpIniLoaded,
    'status' => $zipLoaded ? 'OK' : 'ERROR',
    'message' => $zipLoaded 
        ? 'ZipArchive extension is ENABLED. DOCX generation should work.' 
        : 'ZipArchive extension is DISABLED. Please enable it in php.ini and restart Apache.',
    'instructions' => $zipLoaded ? null : [
        '1. Open: ' . $phpIniLoaded,
        '2. Find: ;extension=zip',
        '3. Change to: extension=zip',
        '4. Save the file',
        '5. Restart Apache in XAMPP Control Panel'
    ]
];

echo json_encode($result, JSON_PRETTY_PRINT);
?>

