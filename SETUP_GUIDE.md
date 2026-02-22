# 🚀 Inventory Management System - Setup Guide

This guide will help you set up the Inventory Management System on a new device after cloning the repository.

## 📋 Prerequisites

- **XAMPP** (or similar local server with MySQL and PHP)
- **Node.js** (for React frontend)
- **Composer** (for PHP dependencies)

## 🔧 Step-by-Step Setup

### 1. **Clone the Repository**
```bash
git clone <your-repository-url>
cd CapstoneProject4
```

### 2. **Database Setup**

#### Option A: Using XAMPP
1. Start **XAMPP Control Panel**
2. Start **Apache** and **MySQL** services
3. Open **phpMyAdmin** (http://localhost/phpmyadmin)
4. Create a new database named `capstone_inventory`

#### Option B: Using MySQL Command Line
```sql
CREATE DATABASE capstone_inventory;
```

### 3. **Backend Setup (Laravel)**

```bash
# Navigate to server directory
cd server

# Install PHP dependencies
composer install

# Copy environment file
copy .env.example .env

# Edit .env file with your database settings
# Make sure these match your database:
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=capstone_inventory
DB_USERNAME=root
DB_PASSWORD=

# Generate application key
php artisan key:generate

# Run database migrations
php artisan migrate

# Seed the database with initial data
php artisan db:seed

# Start the Laravel server
php artisan serve --host=127.0.0.1 --port=8000
```

### 4. **Frontend Setup (React)**

Open a new terminal window:

```bash
# Navigate to client directory
cd client

# Install Node.js dependencies
npm install

# Start the React development server
npm start
```

### 5. **Access the Application**

- **Frontend**: http://localhost:3000
- **Backend API**: http://127.0.0.1:8000

## 👤 Default Login Credentials

After running the setup, you can log in with these accounts:

### Admin Account
- **Email**: admin@inventory.com
- **Password**: admin123
- **Role**: Administrator (full access)

### Teacher Account
- **Email**: teacher@school.com
- **Password**: teacher123
- **Role**: Teacher (limited access)

## 🛠️ Quick Setup Script

If you prefer an automated setup, you can use the provided script:

```bash
# Navigate to server directory
cd server

# Run the setup script
php setup_new_device.php
```

This script will:
- Test database connection
- Create admin and teacher users
- Provide login credentials
- Give you next steps

## 🔍 Troubleshooting

### Database Connection Issues
- Make sure MySQL is running in XAMPP
- Check your `.env` file database credentials
- Ensure the database `capstone_inventory` exists

### Port Already in Use
- If port 8000 is busy: `php artisan serve --host=127.0.0.1 --port=8001`
- If port 3000 is busy: `npm start -- --port 3001`

### Missing Dependencies
- Run `composer install` in the server directory
- Run `npm install` in the client directory

### Permission Issues
- Make sure the `storage` and `bootstrap/cache` directories are writable
- Run `php artisan storage:link` if needed

## 📁 Project Structure

```
CapstoneProject4/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # Reusable components
│   │   ├── pages/         # Page components
│   │   └── context/       # React context
│   └── package.json
├── server/                # Laravel backend
│   ├── app/
│   ├── database/
│   ├── routes/
│   └── artisan
└── SETUP_GUIDE.md        # This file
```

## 🎯 Features

- **Inventory Management**: Add, edit, delete inventory items
- **User Management**: Admin and teacher roles
- **Request System**: Teachers can request items
- **Report System**: Report damaged or missing items
- **QR Code Generation**: Automatic QR codes for items
- **Image Upload**: Support for item images
- **Real-time Updates**: Live data refresh

## 📞 Support

If you encounter any issues during setup, check:

1. **XAMPP Status**: Ensure Apache and MySQL are running
2. **Database**: Verify `capstone_inventory` database exists
3. **Ports**: Check if ports 3000 and 8000 are available
4. **Dependencies**: Ensure all packages are installed
5. **Environment**: Verify `.env` file configuration

## 🔐 Security Notes

- Change default passwords after first login
- Update admin credentials for production use
- Configure proper database permissions
- Use environment variables for sensitive data

---

**Happy coding! 🎉**

