This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## User Authentication System

### Registration Flow

The SHG application includes a comprehensive user registration system with role-based access control. The registration process supports two primary user roles:

1. **MEMBER**: Regular members of self-help groups who need a valid Member ID to register
2. **GROUP_LEADER**: Group leaders who can create and manage groups

#### Features

- **Role Selection**: Users can choose their appropriate role during registration
- **Member ID Validation**: Real-time validation of Member IDs for members
- **Password Strength Checking**: Visual feedback on password strength
- **Link to Existing Records**: Members are linked to existing member records via Member ID

#### Registration Process

1. User enters their name, email, and creates a password
2. User selects their role (MEMBER or GROUP_LEADER)
3. If MEMBER role is selected, user provides their Member ID (provided by group leader)
4. The system validates all data, including real-time Member ID verification
5. Upon successful registration, user is redirected to a confirmation page
6. User can then log in with their new credentials

#### API Endpoints

- `/api/auth/register` - Creates new user accounts
- `/api/auth/check-member-id` - Validates member IDs before registration

#### Role Permissions

- **ADMIN**: System administrators with full access to all features
- **GROUP_LEADER**: Can create groups, manage members, and view member details
- **MEMBER**: Can view their own groups and participate in group activities

### Testing

To test the registration flow, run:

```bash
node scripts/verify-registration-flow.js
```
