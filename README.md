# SHG Management System

A comprehensive **Self-Help Group (SHG) Management System** built with Next.js, designed to streamline the management of Self-Help Groups, their members, contributions, loans, and financial records.

## Live Application

**Access the live application**: [https://shg-mangement.vercel.app/](https://shg-mangement.vercel.app/)

### Quick Start (Live App)
1. Visit the live application at [https://shg-mangement.vercel.app/](https://shg-mangement.vercel.app/)
2. Register as a GROUP_LEADER to create and manage groups
3. Or register as a MEMBER with a valid Member ID
4. Start managing your Self-Help Groups immediately!

### Demo Features Available
-  **User Registration & Login** - Create your account and start using the system
-  **Group Management** - Create and manage multiple self-help groups
-  **Member Management** - Add members manually or import from PDF/Excel
-  **Contribution Tracking** - Track member payments and contributions
-  **Financial Reports** - Generate comprehensive financial reports
-  **Period Management** - Manage collection periods and transitions
-  **Loan Management** - Handle member loans and interest calculations
-  **PDF Import** - Advanced PDF parsing for member data extraction

##  Deployment

### Live Production App
** Live URL**: [https://shg-mangement.vercel.app/](https://shg-mangement.vercel.app/)

The application is deployed on Vercel and ready for production use. All features are fully functional in the live environment.

### Local Development Setup

#### Prerequisites
- Node.js (v18 or higher)
- MongoDB database
- npm or yarn package manager

#### Installation
1. Clone the repository:
```bash
git clone <repository-url>
cd SHG-Management-main
```

2. Install dependencies:
```bash
npm install
# or
yarn install
```

3. Set up environment variables:
Create a `.env.local` file in the root directory with:
```env
DATABASE_URL="your-mongodb-connection-string"
NEXTAUTH_SECRET="your-nextauth-secret"
NEXTAUTH_URL="http://localhost:3000"
```

4. Initialize the database:
```bash
npm run migrate
```

5. Run the development server:
```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000) with your browser to see the application.

### Production Deployment
1. **Environment Setup**: Configure production environment variables
2. **Database Setup**: Set up production MongoDB database
3. **Build Application**: `npm run build`
4. **Start Server**: `npm run start`

### Environment Variables
```env
DATABASE_URL="mongodb://production-url"
NEXTAUTH_SECRET="production-secret"
NEXTAUTH_URL="https://your-domain.com"
```

##  Core Features

### 1. User Authentication & Authorization

#### **Role-Based Access Control**
- **ADMIN**: Full system access and administration
- **GROUP_LEADER**: Can create and manage groups, handle member activities
- **MEMBER**: Can view their groups and participate in activities

#### **Registration System**
- User registration with role selection
- Member ID validation for member accounts
- Password strength checking
- Email verification system

#### **Login Features**
- Secure authentication with NextAuth
- Session management
- Role-based dashboard redirection

### 2. Group Management

#### **Create Groups**
- **Basic Information**: Name, address, registration number, organization
- **Collection Settings**: Frequency (Weekly, Fortnightly, Monthly, Yearly)
- **Banking Details**: Bank account information
- **Financial Settings**: Interest rates, monthly contributions, cash balances
- **Insurance & Social Fund**: Optional insurance and social fund settings
- **Late Fine Rules**: Configurable late fine policies (daily fixed, percentage, tier-based)

#### **Edit Groups**
- Modify all group settings
- Update member information
- Change financial parameters
- Manage collection schedules

#### **Advanced Group Features**
- **Custom Columns**: Add custom fields specific to group needs
- **Period Tracking**: Track data till specific periods
- **Leader Assignment**: Assign group leaders from member list

### 3. Member Management

#### **Member Registration**
- Personal information (name, contact details)
- Family member count
- Initial loan amounts
- Group membership assignment

#### **Member Import**
- **PDF Import**: Advanced PDF parsing for member data extraction
- **Excel Import**: Bulk member import from Excel files
- **Manual Entry**: Individual member addition

#### **Member Features**
- View member profiles
- Track contribution history
- Monitor loan status
- Update personal information

### 4. Contribution Management

#### **Contribution Tracking**
- **Period-Based Tracking**: Organize contributions by collection periods
- **Individual Member Tracking**: Monitor each member's contribution status
- **Payment Status**: Track paid/unpaid contributions
- **Backdated Payments**: Allow payment submission for past dates

#### **Advanced Contribution Features**
- **Late Fine Calculation**: Automatic calculation based on group rules
- **Interest Calculation**: Loan interest tracking
- **Carry Forward**: Unpaid amounts carried to next period
- **Bulk Operations**: Mark multiple payments at once

#### **Period Management**
- **Close Periods**: Finalize contribution periods
- **Reopen Periods**: Reopen closed periods for corrections
- **Period History**: View historical contribution data
- **Automatic Period Creation**: System creates new periods automatically

### 5. Financial Management

#### **Cash Management**
- **Cash in Hand**: Track physical cash
- **Bank Balance**: Monitor bank account balances
- **Cash Allocation**: Distribute collections between cash and bank

#### **Financial Reports**
- **Group Summary**: Overall financial position
- **Contribution Reports**: Detailed contribution analysis
- **Interest Analysis**: Loan interest profit/loss tracking
- **Period Reports**: Financial data by period

#### **Banking Integration**
- **Bank Transactions**: Record bank-related transactions
- **Account Management**: Manage multiple bank accounts
- **Transaction History**: Complete transaction audit trail

### 6. Loan Management

#### **Loan Processing**
- **Loan Application**: Handle member loan requests
- **Loan Approval**: Approve/reject loan applications
- **Loan Disbursement**: Record loan distributions
- **Repayment Tracking**: Monitor loan repayments

#### **Loan Features**
- **Interest Calculation**: Automatic interest computation
- **Loan Balance**: Track outstanding amounts
- **Repayment History**: Complete payment history
- **Loan Status**: Active, closed, overdue status tracking

### 7. Periodic Records

#### **Meeting Records**
- **Meeting Details**: Date, attendance, agenda
- **Financial Summary**: Period's financial activities
- **Member Contributions**: Individual member data
- **Group Standing**: Total group financial position

#### **Financial Calculations**
- **Starting Balance**: Period beginning balance
- **Collections**: Total period collections
- **Expenses**: Period expenses
- **Ending Balance**: Period closing balance
- **Group Standing**: Total assets (cash + loans)

### 8. Reporting & Analytics

#### **Financial Reports**
- **Group Summary**: Comprehensive financial overview
- **Contribution Analysis**: Member-wise contribution patterns
- **Interest Profit Analysis**: Loan interest income vs expenses
- **Period-wise Reports**: Financial data by periods

#### **PDF Generation**
- **Contribution Reports**: Detailed member contribution reports
- **Group Summary**: Complete group financial summary
- **Member Reports**: Individual member activity reports

#### **Export Features**
- **PDF Export**: All reports available in PDF format
- **Excel Export**: Data export for further analysis
- **Print-friendly**: Optimized for printing

### 9. Advanced Features

#### **Custom Columns**
- **Group-specific Fields**: Add custom fields for each group
- **Flexible Data Types**: Text, number, date, boolean fields
- **Dynamic Forms**: Forms adapt to custom column configuration

#### **PDF Processing**
- **Advanced PDF Parsing**: Extract member data from various PDF formats
- **Pattern Recognition**: Intelligent data extraction
- **Multiple Formats**: Support for different PDF layouts

#### **Late Fine Management**
- **Rule Types**: Daily fixed, percentage, tier-based rules
- **Automatic Calculation**: System calculates fines automatically
- **Flexible Configuration**: Customize fine rules per group

#### **Period Transition**
- **Automatic Period Creation**: System creates new periods
- **Data Carryover**: Unpaid amounts carry to next period
- **Seamless Transition**: Smooth period-to-period flow

##  How to Use

### For Group Leaders

1. **Create Account**: Register as GROUP_LEADER
2. **Create Group**: Set up new group with all settings
3. **Add Members**: Import or manually add group members
4. **Set Collection Schedule**: Configure contribution frequency
5. **Track Contributions**: Monitor member payments
6. **Manage Periods**: Close periods and create new ones
7. **Generate Reports**: Create financial reports

### For Members

1. **Create Account**: Register as MEMBER with valid Member ID
2. **View Groups**: See groups you're part of
3. **Check Contributions**: Monitor your contribution status
4. **View Reports**: Access your financial reports

### For Administrators

1. **System Management**: Oversee all groups and members
2. **User Management**: Manage user accounts and permissions
3. **System Reports**: Generate system-wide reports
4. **Data Management**: Handle data imports and exports

##  Technical Features

### Built With
- **Frontend**: Next.js 15, React 19, TypeScript
- **Backend**: Next.js API Routes, Prisma ORM
- **Database**: MongoDB
- **Authentication**: NextAuth.js
- **Styling**: Tailwind CSS
- **PDF Processing**: pdf-parse, pdf2json
- **Forms**: React Hook Form, Zod validation
- **Charts**: Chart.js integration
- **Date Handling**: React DatePicker

### Security Features
- **Role-based Access Control**: Secure user permissions
- **Input Validation**: Comprehensive data validation
- **SQL Injection Prevention**: Prisma ORM protection
- **Session Management**: Secure session handling
- **Password Hashing**: Bcrypt password encryption

### Performance Features
- **Server-side Rendering**: Fast page loads
- **API Optimization**: Efficient database queries
- **Caching**: Smart data caching
- **Lazy Loading**: Optimized component loading

##  API Documentation

### Authentication Endpoints
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/session` - Get current session

### Group Management
- `GET /api/groups` - List all groups
- `POST /api/groups` - Create new group
- `GET /api/groups/[id]` - Get group details
- `PUT /api/groups/[id]` - Update group
- `DELETE /api/groups/[id]` - Delete group

### Member Management
- `GET /api/members` - List all members
- `POST /api/members` - Create new member
- `GET /api/members/[id]` - Get member details
- `PUT /api/members/[id]` - Update member
- `POST /api/members/import` - Import members

### Contribution Management
- `GET /api/groups/[id]/contributions` - Get contributions
- `POST /api/groups/[id]/contributions` - Create contribution
- `PATCH /api/groups/[id]/contributions/[contributionId]` - Update contribution
- `POST /api/groups/[id]/contributions/periods/close` - Close period

### Financial Management
- `GET /api/groups/[id]/summary` - Get financial summary
- `GET /api/groups/[id]/periodic-records` - Get periodic records
- `POST /api/groups/[id]/periodic-records` - Create periodic record

##  Configuration

### Collection Frequencies
- **Weekly**: Every week on specified day
- **Fortnightly**: Every two weeks (1st & 3rd OR 2nd & 4th)
- **Monthly**: Every month on specified date
- **Yearly**: Once per year on specified date

### Late Fine Rules
- **Daily Fixed**: Fixed amount per day late
- **Daily Percentage**: Percentage of contribution per day
- **Tier-based**: Different rates for different time periods

### Custom Columns
- **Text Fields**: Single-line or multi-line text
- **Number Fields**: Integer or decimal numbers
- **Date Fields**: Date selection
- **Boolean Fields**: True/false options


##  Database Schema

### Core Models
- **User**: Authentication and user management
- **Group**: Self-help group information
- **Member**: Individual member data
- **GroupMembership**: Member-group relationships
- **GroupPeriodicRecord**: Period-based financial records
- **MemberContribution**: Individual contribution tracking
- **Loan**: Loan management
- **LateFineRule**: Late fine configuration

### Relationships
- Groups have many Members through Memberships
- Periods belong to Groups and have many Member Contributions
- Loans belong to Members and Groups
- Users can be Members or Group Leaders

## 🐛 Troubleshooting

### Common Issues
1. **Database Connection**: Check MongoDB connection string
2. **Authentication**: Verify NextAuth configuration
3. **PDF Import**: Ensure PDF files are readable
4. **Period Closing**: Check contribution data completeness

### Debug Mode
Set `DEBUG=true` in environment variables for detailed logging.
