# Compassion Tracker

A comprehensive caregiver support application designed to streamline health management, emergency preparedness, and care coordination for families caring for loved ones.

## Features

- **Multi-recipient Care Management**: Track multiple family members with color-coded organization
- **Medication Management**: Complete medication tracking with scheduling, inventory management, and reorder alerts
- **Health Monitoring**: Track blood pressure, glucose/insulin, bowel movements, meals, and sleep patterns
- **Appointment Scheduling**: Manage doctor appointments with reminders
- **Emergency Information**: Secure PIN-protected emergency contact and medical information
- **Care Notes**: Document daily observations and important care notes
- **Doctor & Pharmacy Management**: Store healthcare provider information and associate medications with pharmacies

## Tech Stack

- **Frontend**: React, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Node.js, Express, TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Passport.js with session management
- **Email**: Nodemailer for password recovery

## Deployment

### Environment Variables Required

Set these in your Render environment:

```
NODE_ENV=production
SESSION_SECRET=your-secure-session-secret
DATABASE_URL=your-postgresql-url
EMAIL_FROM=your-email@example.com
EMAIL_APP_PASSWORD=your-app-password
```

### Deploy to Render

1. Connect your GitHub repository to Render
2. Set the environment variables above
3. Render will automatically build and deploy using the included `render.yaml` configuration

## Development

```bash
npm install
npm run dev
```

## Database Setup

The application will automatically create database tables on first run in production. For development:

```bash
npm run db:push
npm run db:seed
```

## License

Private - Family Caregiving Application