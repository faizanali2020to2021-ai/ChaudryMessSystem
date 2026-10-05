# Chaudry Mess System — Web Application (SQL Server 2014)

A complete, production-ready web application built from the Android mobile application codebase in `ExpenseAppweb.rar`. It replicates the exact business logic, split calculations, theme styling, and all 6 financial reports, running natively against **Microsoft SQL Server 2014**.

---

## 🚀 Quick Start

1. **Start the Web Application**:
   - Double-click [`Start_WebApp.bat`](file:///d:/AI%20Video/Szkundimess/Start_WebApp.bat) OR run:
     ```powershell
     cd webapp
     node server/index.js
     ```
   - Open your browser at: **[http://localhost:3000](http://localhost:3000)**

2. **Default Login Credentials**:
   - **Username**: `admin`
   - **Password**: `changeme123`

---

## 🗄️ Microsoft SQL Server 2014 Integration

- **Database Name**: `ChaudryMessDB`
- **Instance**: Local default instance (`localhost:1433` / `MSSQLSERVER`)
- **SQL Script**: [`sql_scripts/schema.sql`](file:///d:/AI%20Video/Szkundimess/sql_scripts/schema.sql)
- **Database Tables**:
  - `dbo.AppUser`: Singleton identity and settings row (`username`, `shopName`, `passwordHash`, `passwordSalt`, `shopAddress`, `hasLoggedInOnce`).
  - `dbo.Persons`: Active members & participants with mobile numbers for WhatsApp linking and soft-delete protection.
  - `dbo.Expenses`: Expense records with date (epoch ms), description, total amount, `paidByPersonId`, and optional category tag (`Breakfast`, `Lunch`, `Dinner`, `Others`).
  - `dbo.ExpenseShares`: Individual split records with `expenseId`, `personId`, and `shareAmount`.
  - `dbo.GoogleAccount`: System backup/restore timestamps and metadata.

---

## 📋 Features & Exact Mobile App Parity

### 1. Dashboard
- **Header Summary Cards**: Total Expense and Total Paid amounts.
- **Member Summary Grid**: Colorful cards per person displaying:
  - Total allocated expense share
  - Total amount paid
  - Live Receivable (▲ Green) or Payable (▼ Red) balance badge.
- One-click navigation from any person's card directly into their detailed ledger report.

### 2. Expense Entry (Add & Edit)
- Date picker (defaults to today, editable).
- Description & Category tags (`Breakfast`, `Lunch`, `Dinner`, `Others`).
- "Paid By" member selector.
- Split multi-select with **Live Real-Time Share Preview**:
  - Automatically calculates `Rs. X.XX / person (N members)` as you type.
  - Quick "Select All" and "Clear" buttons.
- **Exact Split Algorithm**: Equal division rounded to 2 decimal places, with the exact remainder allocated to the last participant so `sum(shares) == amount` down to the exact cent/paisa.

### 3. Expenses List Screen
- Live search filtering by description or person name.
- Filter by member dropdown ("All Persons" or specific person).
- Sorting options: Newest first, Oldest first, Amount high-to-low, Amount low-to-high.
- Edit and Delete actions with transaction-safe updates.

### 4. Persons Management
- Add & Edit members with name and international mobile number (E.164, e.g. `+923001234567`).
- **Safe Dependency Deletion**: If a member has expense or payment history, they are safely soft-deleted (`isActive = 0`) to preserve historical reports. If they have zero history, they are permanently removed.

### 5. All 6 Reports (Identical to Mobile App)

| # | Report Name | Description | Key Outputs & Actions |
|---|-------------|-------------|-----------------------|
| 1 | **Total Expense Report** | Date range filtered list of all mess expenses | Summary cards (Transactions, Total Expense), zebra table (Date, Description, Paid By, Amount), Grand Total. Print/PDF, CSV export. |
| 2 | **Paid by Person Report** | Date range breakdown of total amounts paid per member | Summary cards (Total Members, Grand Total Paid), member cards showing individual contributions. |
| 3 | **Individual Person Ledger Report** | High-level summary of an individual member's account | Total Paid, Total Allocated Share, Large Highlighted Card (▲ Amount Receivable in green or ▼ Amount Payable in red). One-click WhatsApp share! |
| 4 | **Individual Person Detail Ledger Report** | Itemized row-by-row breakdown of every expense the person shared in | Table: Date, Description, Total Amount, Split Count, Your Share. Bottom summary: Total Amount, Total Paid Amount, Total Receivable/Payable Amount. Print/PDF & WhatsApp Share button! |
| 5 | **Day-Wise Expense Report** | Expenses grouped by calendar date, then broken down by Meal category (`Breakfast`, `Lunch`, `Dinner`, `Others`) | Shows exact formula: `Total Rs. X ÷ N persons = Rs. Y`. Supports optional person filter with Your Total Expense, Total Paid, and Receivable/Payable balance. |
| 6 | **Group Summary & Settlement Report** | Overview of all member balances plus greedy debt settlement | Calculates the **mathematically minimal set of direct person-to-person debt payments** (`Debtor → Creditor: Rs. Amount`). |

### 6. WhatsApp Sharing
- On individual member reports, clicking **"💬 Share on WhatsApp"** generates a preformatted, professional summary message and opens `https://wa.me/<number>?text=...` directly.

### 7. Native SQL Server Backup
- On the **Settings & Backup** screen, clicking **"Create Database Backup (.bak)"** executes a native `BACKUP DATABASE [ChaudryMessDB]` command on Microsoft SQL Server 2014 and stores timestamped `.bak` files inside `webapp/backups/`.

### 8. Theming & Styling
- Material 3 aesthetic matching the mobile app:
  - Primary Pine Green: `#2E5C4E`
  - Secondary Pine: `#3D7A65`
  - Positive/Receivable: `#DFF5E4` / `#0F5C25`
  - Negative/Payable: `#FBE1E1` / `#8A1616`
  - Stat Blue: `#E3ECFB` / `#1B4B96`
- Dark Mode toggle with preference persistence.
- Clean A4 print layout via `@media print`.
