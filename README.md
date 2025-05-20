# Compassion Tracker

A comprehensive caregiver support application designed to streamline health management, emergency preparedness, and care coordination for families caring for loved ones.

## Features

- **Medication Tracking**: Schedule, track, and manage medications with inventory alerts
- **Health Monitoring**: Track vital signs, glucose levels, blood pressure, and more
- **Care Recipient Management**: Manage multiple care recipients with color coordination
- **Emergency Information**: Securely store critical medical information with PIN protection
- **Appointment Calendar**: Keep track of doctor appointments and medical events
- **Doctor & Pharmacy Management**: Store contact information and specialties

## Technologies

- **Frontend**: React, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Express.js, Node.js
- **Database**: PostgreSQL with Drizzle ORM
- **API**: RxNorm for medication information and drug interaction checking

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/compassion-tracker.git
   cd compassion-tracker
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Set up environment variables:
   Create a `.env` file in the root directory with the following variables:
   ```
   DATABASE_URL=postgresql://username:password@localhost:5432/compassion_tracker
   NODE_ENV=development
   SESSION_SECRET=your_session_secret_here
   ```

4. Initialize the database:
   ```
   npm run db:push
   npm run db:seed
   ```

5. Start the development server:
   ```
   npm run dev
   ```

6. Open your browser and navigate to `http://localhost:5000`

## Deployment

This application can be deployed on platforms like Render or Heroku. Make sure to set the following environment variables:

- `DATABASE_URL` - Your PostgreSQL connection string
- `NODE_ENV` - Set to "production"
- `SESSION_SECRET` - A strong random string for session security

## License

This project is licensed under the MIT License - see the LICENSE file for details.