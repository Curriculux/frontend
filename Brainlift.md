# Curriculux Frontend - Complete Brain Lift

## Project Overview

Curriculux is a comprehensive K-12 education platform built with modern web technologies. The frontend is a Next.js 15 application with TypeScript, featuring a rich interface for educators, students, and administrators to manage classes, assignments, grading, and virtual meetings.

## Architecture & Tech Stack

### Core Technologies
- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS 4 + shadcn/ui components
- **Animations**: Framer Motion
- **State Management**: React Context + Custom Hooks
- **API Integration**: Custom PloneAPI class for backend communication
- **Real-time**: Socket.IO for WebRTC signaling
- **File Storage**: AWS S3 integration with fallback to Plone

### Key Dependencies
```json
{
  "next": "15.4.2",
  "react": "19.1.0",
  "typescript": "^5",
  "@aws-sdk/client-s3": "^3.850.0",
  "socket.io": "^4.8.1",
  "simple-peer": "^9.11.1",
  "recordrtc": "^5.6.2",
  "framer-motion": "^12.23.6",
  "date-fns": "^4.1.0",
  "sonner": "^2.0.6"
}
```

## Security & Authentication

### Authentication System (`src/lib/auth.tsx`)
- **JWT-based authentication** with Plone backend
- **Persistent sessions** via localStorage + HTTP-only cookies
- **Role-based access control** with security context
- **Automatic token refresh** and logout handling

### Security Manager (`src/lib/security.ts`)
- **Multi-role system**: Student, Teacher, Dean, Administrator
- **Permission-based UI rendering** and API access
- **Data classification levels**: Public, Educational, Restricted, Confidential
- **Context-aware security checks** throughout the application

### User Roles & Permissions
```typescript
// Student: Can view own classes, assignments, submit work
// Teacher: Can manage classes, create assignments, grade students
// Dean: Can view all classes, manage teachers and students
// Administrator: Full system access, user management
```

## User Interface Architecture

### Component Structure
```
src/components/
├── ui/              # shadcn/ui base components
├── *-view.tsx       # Main view components
├── *-dialog.tsx     # Modal/dialog components
├── *-modal.tsx      # Complex modal components
└── *.tsx           # Feature-specific components
```

### Key UI Components

#### Navigation System
- **AppSidebar**: Role-based navigation with animated icons
- **Dashboard views**: Separate interfaces for students vs teachers/admins
- **Responsive design** with mobile-first approach

#### Modal System
- **Assignment creation/submission dialogs**
- **Student/teacher management modals**
- **Class details and configuration**
- **Grade management interfaces**

## User Experience by Role

### Student Experience
- **Student Dashboard** (`student-dashboard.tsx`): Overview of classes, assignments, grades
- **Assignment Submission** (`assignment-submission-dialog.tsx`): File upload with progress tracking
- **Class Details** (`student-class-details-modal.tsx`): View class info, meetings, assignments
- **Grade Tracking** (`student-grades-view.tsx`): Personal grade analytics
- **Meeting Participation**: Join virtual classrooms

### Teacher Experience
- **Class Management** (`classes-view.tsx`): Create/manage classes and enrollment
- **Assignment Creation** (`create-assignment-dialog.tsx`): Rich assignment creation with rubrics
- **Gradebook System** (`enhanced-gradebook-view.tsx`): Comprehensive grading interface
- **Student Management** (`students-view.tsx`): View/edit student information
- **Meeting Hosting**: Create and manage virtual classrooms

### Administrator Experience
- **User Management**: Create teacher/student accounts
- **System Analytics**: View platform-wide statistics
- **Security Oversight**: Access to all system functions

## Academic Features

### Assignment System
- **Rich assignment creation** with due dates, points, instructions
- **Rubric integration** for detailed grading criteria
- **File upload support** with S3 storage
- **Submission tracking** with late penalty calculations
- **Bulk grading operations** for efficiency

### Gradebook & Assessment
- **Weighted category system** (Homework, Tests, Projects, Participation)
- **Flexible grading scales** (Standard, IB, AP)
- **Mastery-based grading** with standards alignment
- **Grade analytics and trends** for student progress tracking
- **Parent notification system** for grade updates

### Class Management
- **Multi-class support** for teachers
- **Student enrollment management**
- **Class-specific settings** and customization
- **Meeting integration** within class context

## Virtual Classroom System

### WebRTC Meeting Platform
- **Real-time video conferencing** (`webrtc-meeting-client.tsx`)
- **Interactive whiteboard** (`interactive-whiteboard.tsx`) with collaborative drawing
- **Screen sharing capabilities**
- **Meeting recording** with S3 storage
- **Participant management** and controls

### Meeting Features
- **Audio/video controls** with mute/unmute
- **Grid and presenter views**
- **Whiteboard collaboration** with real-time sync
- **Recording management** with automatic upload
- **Meeting analytics** and attendance tracking

### Technical Implementation
- **Socket.IO signaling server** (`src/server/signaling.js`)
- **WebRTC peer connections** via simple-peer
- **Recording via RecordRTC** with automatic compression
- **S3 integration** for large file storage

## Gradebook System Architecture

### Core Components
```typescript
// Enhanced grading with rubrics and analytics
interface EnhancedGrade {
  points: number;
  maxPoints: number;
  percentage: number;
  rubricScores?: RubricScore[];
  feedback?: string;
  isLate?: boolean;
  categoryId: string;
}

// Weighted category system
interface WeightedCategory {
  id: string;
  name: string;
  weight: number;        // Percentage (0-100)
  dropLowest: number;    // Drop lowest N scores
  color: string;         // UI color coding
}
```

### Grading Features
- **Multi-category weighting** with customizable percentages
- **Drop lowest scores** functionality per category
- **Late penalty calculations** with configurable rules
- **Rubric-based grading** with detailed criteria
- **Bulk grading operations** for efficiency
- **Grade curve applications** with various methods

### Analytics & Reporting
- **Grade distribution analysis**
- **Student progress tracking** with trend analysis
- **Assignment performance statistics**
- **At-risk student identification**
- **Parent progress reports**

## Data Management

### API Layer (`src/lib/api.ts`)
- **PloneAPI class** with 5,900+ lines of comprehensive backend integration
- **JWT token management** with automatic refresh
- **Error handling** with user-friendly messages
- **Type-safe interfaces** for all data models

### Key Data Models
```typescript
interface PloneClass {
  id: string;
  title: string;
  description: string;
  teacher: string;
  students: string[];
  assignments: string[];
  meetings: string[];
}

interface PloneAssignment {
  id: string;
  title: string;
  description: string;
  dueDate?: string;
  points?: number;
  classId: string;
  submissions: Submission[];
}

interface PloneMeeting {
  id: string;
  title: string;
  startTime: string;
  duration: number;
  meetingType: 'class' | 'office-hours' | 'meeting';
  autoRecord: boolean;
  recordingUrl?: string;
}
```

### File Storage Strategy
- **Primary**: AWS S3 for scalability and performance
- **Fallback**: Plone backend for simple deployments
- **Automatic switching** based on configuration
- **Presigned URLs** for secure file access

## Development & Deployment

### Development Scripts
```bash
npm run dev        # Start Next.js + signaling server
npm run dev:next   # Next.js only with Turbopack
npm run build      # Production build
npm run lint       # ESLint checking
```

### Environment Configuration
```bash
# Plone Backend
NEXT_PUBLIC_PLONE_URL=http://localhost:8080/Plone

# AWS S3 (Optional)
NEXT_PUBLIC_AWS_REGION=us-east-1
NEXT_PUBLIC_S3_BUCKET_NAME=curriculux-media
NEXT_PUBLIC_AWS_ACCESS_KEY_ID=your_key
NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY=your_secret
```

### Key Configuration Files
- `next.config.ts`: Next.js configuration with API proxying
- `tailwind.config.ts`: Tailwind customization with shadcn/ui
- `middleware.ts`: Route protection and authentication
- `package.json`: Dependencies and development scripts

## Performance Optimizations

### Frontend Optimizations
- **Next.js 15** with Turbopack for faster development
- **Code splitting** by route and component
- **Image optimization** with Next.js Image component
- **Lazy loading** for heavy components
- **Memoization** for expensive calculations

### Real-time Features
- **WebRTC** for direct peer-to-peer communication
- **Socket.IO** for signaling and collaboration
- **Efficient state management** to minimize re-renders
- **Background processing** for file uploads

## Testing & Quality

### Code Quality
- **TypeScript** for type safety
- **ESLint** for code consistency
- **Strict mode** React components
- **Error boundaries** for graceful failure handling

### User Experience
- **Loading states** throughout the application
- **Error messages** with actionable guidance
- **Progress indicators** for long operations
- **Responsive design** for all device sizes

## Mobile Responsiveness

### Responsive Design Strategy
- **Mobile-first approach** with Tailwind CSS
- **Touch-friendly interfaces** for tablets
- **Adaptive layouts** based on screen size
- **Optimized video conferencing** for mobile devices

## Future Extensibility

### Architectural Decisions for Growth
- **Modular component structure** for easy feature addition
- **Plugin-ready gradebook system** for custom grading methods
- **Extensible security framework** for new roles
- **API abstraction layer** for backend flexibility

### Integration Points
- **LTI compatibility** for external tool integration
- **SSO preparation** for enterprise authentication
- **Webhook system** for external notifications
- **Export capabilities** for data portability

## Key Files Reference

### Core Application
- `src/app/page.tsx`: Main dashboard with role-based routing
- `src/app/layout.tsx`: Root layout with providers
- `src/app/login/page.tsx`: Authentication interface

### Authentication & Security
- `src/lib/auth.tsx`: Authentication context and hooks
- `src/lib/security.ts`: Role-based access control
- `src/middleware.ts`: Route protection

### API & Data
- `src/lib/api.ts`: Comprehensive Plone backend integration
- `src/lib/gradebook-api.ts`: Specialized gradebook operations
- `src/types/gradebook.ts`: Comprehensive type definitions

### Virtual Classroom
- `src/components/webrtc-meeting-client.tsx`: Main meeting interface
- `src/components/interactive-whiteboard.tsx`: Collaborative whiteboard
- `src/lib/webrtc-manager.ts`: WebRTC connection management
- `src/server/signaling.js`: Real-time signaling server

### UI Components
- `src/components/enhanced-gradebook-view.tsx`: Advanced grading interface
- `src/components/assignment-details-modal.tsx`: Assignment management
- `src/components/student-dashboard.tsx`: Student-specific interface
- `src/components/app-sidebar.tsx`: Role-based navigation

## Implementation Highlights

### Security-First Design
- **Role-based UI rendering** prevents unauthorized access
- **Data classification levels** protect sensitive information
- **Context-aware permissions** throughout the application

### Rich Grading System
- **Weighted categories** with flexible configuration
- **Rubric integration** for detailed assessment
- **Analytics and trends** for educational insights
- **Bulk operations** for teacher efficiency

### Real-time Collaboration
- **WebRTC video conferencing** with recording
- **Collaborative whiteboard** with real-time sync
- **Socket.IO infrastructure** for reliable communication

### Modern Development Practices
- **TypeScript everywhere** for type safety
- **Component composition** for reusability
- **Error boundaries** for resilient UX
- **Performance monitoring** built-in

This frontend represents a comprehensive K-12 education platform with enterprise-grade features, modern development practices, and scalable architecture ready for production deployment. 