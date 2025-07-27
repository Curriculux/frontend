# Cirriculux Frontend

A comprehensive K-12 education platform built with Next.js, TypeScript, and Tailwind CSS, integrated with Plone CMS backend.

## Features

### **Dashboard & Analytics**
- **Role-based dashboards** for admins, teachers, and students
- **Real-time statistics** - classes, students, assignments, system status
- **Schedule widget** with timezone-aware event display
- **Smart greetings** based on user's timezone
- **Live clock** displaying time in user's preferred timezone

### **User Management**
- **Multi-role authentication** (Admin, Teacher, Student)
- **Student enrollment system** - enroll existing students into classes
- **Teacher account creation** with proper role assignment
- **Permission management** with security context

### **Class Management**
- **Class creation and editing** with grade categories
- **Student roster management** with real-time updates
- **Assignment creation and distribution**
- **Grade categories and weighted grading**
- **Class-specific meetings and recordings**

### **Assignment System**
- **Rich assignment creation** with due dates and instructions
- **File submission system** with S3 integration
- **Grading interface** with rubrics and feedback
- **Student submission tracking** and status management
- **Bulk grading operations**

### **Meeting & Recording**
- **Virtual classroom meetings** with WebRTC
- **Screen sharing and interactive whiteboards**
- **Automatic meeting recording** with audit trails
- **Recording playback** with metadata and participant tracking
- **Meeting recording audit panel** for troubleshooting

### **Settings & Personalization**
- **Role-based settings** - different options for each user type
- **Timezone support** with automatic time conversion across the app
- **Notification preferences** for assignments, grades, and meetings
- **Teaching preferences** for teachers (grading scales, feedback templates)
- **Study tools** for students (Pomodoro timers, reminder settings)

### **Security & Privacy**
- **JWT authentication** with Plone backend
- **Role-based access control** with field-level permissions
- **Data classification** (Public, Internal, Confidential, Restricted)
- **Sensitive data protection** with conditional visibility
- **Account security options** (password changes, 2FA)

## Tech Stack

### **Frontend Framework**
- **Next.js 15** - React framework with App Router
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first styling
- **Framer Motion** - Smooth animations and transitions

### **UI Components**
- **shadcn/ui** - Modern, accessible component library
- **Lucide React** - Beautiful icons
- **Radix UI** - Primitive components
- **React Hook Form** - Form management
- **Sonner** - Toast notifications

### **Backend Integration**
- **Plone CMS** - Content management and user authentication
- **RESTful API** - Communication with Plone backend
- **AWS S3** - File storage for assignments and recordings
- **WebRTC** - Real-time video communication

### **Development Tools**
- **ESLint** - Code linting
- **date-fns & date-fns-tz** - Timezone-aware date handling
- **TypeScript** - Static type checking

## Getting Started

### Prerequisites
- Node.js 18+ and npm
- Running Plone backend (see `../buildout.coredev/`)
- AWS S3 bucket configured (see `S3_SETUP.md`)

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

### Environment Setup

Create a `.env.local` file with:

```env
# Plone Backend
NEXT_PUBLIC_PLONE_URL=http://localhost:8080/Plone

# AWS S3 (for file uploads)
NEXT_PUBLIC_AWS_REGION=us-east-1
NEXT_PUBLIC_S3_BUCKET=your-bucket-name
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key

# Meeting/WebRTC
NEXT_PUBLIC_SIGNALING_SERVER=ws://localhost:3001
```

## Project Structure

```
frontend/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── api/               # API routes and proxies
│   │   ├── classes/           # Class management pages
│   │   ├── gradebook/         # Grading interfaces
│   │   ├── login/             # Authentication
│   │   └── meeting/           # Virtual classroom
│   ├── components/            # React components
│   │   ├── ui/               # Base UI components (shadcn/ui)
│   │   ├── *-view.tsx        # Main page components
│   │   ├── *-dialog.tsx      # Modal dialogs
│   │   └── *-modal.tsx       # Detail modals
│   ├── lib/                   # Utilities and APIs
│   │   ├── api.ts            # Main Plone API client
│   │   ├── auth.ts           # Authentication context
│   │   ├── security.ts       # Role-based access control
│   │   ├── date-utils.ts     # Timezone-aware date formatting
│   │   └── utils.ts          # General utilities
│   ├── hooks/                 # Custom React hooks
│   ├── types/                 # TypeScript type definitions
│   └── middleware.ts          # Next.js middleware
├── public/                    # Static assets
└── docs/                      # Documentation
    ├── S3_SETUP.md           # AWS S3 configuration
    └── WEBRTC_README.md      # WebRTC meeting setup
```

## Key Features Detail

### **Role-Based Access**
- **Admins**: Full system access, user management, system settings
- **Teachers**: Class management, assignment creation, grading
- **Students**: Assignment submission, grade viewing, class participation

### **Student Enrollment**
- Enroll existing students into classes via dropdown selection
- Real-time student list updates after enrollment
- Role-based enrollment permissions

### **Timezone Support**
- User-selectable timezones (EST, PST, UTC, etc.)
- Automatic time conversion throughout the application
- Timezone-aware schedule displays and event times

### **Assignment Workflow**
1. **Teacher** creates assignment with instructions and due date
2. **Students** receive assignment and submit files via drag-and-drop
3. **Teacher** grades submissions with rubrics and feedback
4. **Students** view grades and feedback in their dashboard

### **Meeting System**
1. **Teacher** creates virtual meeting room
2. **Students** join via meeting link
3. **Real-time** video chat with screen sharing
4. **Automatic** recording with participant tracking
5. **Playback** available with metadata and audit trail

## Security Features

- **JWT Authentication** with Plone backend
- **Role-based permissions** at component and API level
- **Data classification** system for sensitive information
- **Secure file uploads** with S3 integration
- **Input validation** and XSS protection

## Responsive Design

- **Mobile-first** responsive design
- **Adaptive layouts** for tablets and desktops
- **Touch-friendly** interfaces for mobile devices
- **Optimized** for various screen sizes

## Contributing

1. Follow TypeScript best practices
2. Use existing UI components from `src/components/ui/`
3. Implement proper role-based access control
4. Add timezone support for any date/time displays
5. Test across different user roles

## License

This project is part of the Cirriculux education platform.

