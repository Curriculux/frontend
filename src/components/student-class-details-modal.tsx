'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ploneAPI } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { 
  BookOpen, 
  Calendar, 
  Clock, 
  User, 
  GraduationCap,
  FileText,
  CheckCircle,
  Circle,
  AlertCircle,
  Award,
  Target,
  TrendingUp,
  Loader2,
  Video,
  Play,
  Eye,
  MoreVertical
} from 'lucide-react';

interface StudentClassDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classData: any;
  studentUsername?: string;
}

interface StudentAssignment {
  id: string;
  title: string;
  description?: string;
  dueDate?: string;
  status: 'pending' | 'submitted' | 'graded';
  grade?: number;
  maxPoints?: number;
  submissionDate?: string;
  feedback?: string;
}

export function StudentClassDetailsModal({ 
  open, 
  onOpenChange, 
  classData,
  studentUsername
}: StudentClassDetailsModalProps) {
  const [assignments, setAssignments] = useState<StudentAssignment[]>([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);
  const [classStats, setClassStats] = useState({
    totalAssignments: 0,
    completedAssignments: 0,
    averageGrade: 0,
    upcomingDeadlines: 0,
    totalMeetings: 0,
    upcomingMeetings: 0
  });
  const { toast } = useToast();

  // Load assignments and calculate stats
  const loadAssignments = async () => {
    if (!classData?.id || !studentUsername) return;
    
    setAssignmentsLoading(true);
    try {
      const assignmentsData = await ploneAPI.getStudentAssignments(studentUsername, classData.id);
      setAssignments(assignmentsData);
      
      // Calculate stats
      const completed = assignmentsData.filter(a => a.status === 'submitted' || a.status === 'graded').length;
      const graded = assignmentsData.filter(a => a.grade !== undefined && a.grade !== null);
      const averageGrade = graded.length > 0 
        ? graded.reduce((sum, a) => sum + (a.grade || 0), 0) / graded.length 
        : 0;
      const upcoming = assignmentsData.filter(a => {
        if (!a.dueDate || a.status !== 'pending') return false;
        const dueDate = new Date(a.dueDate);
        const now = new Date();
        const daysDiff = (dueDate.getTime() - now.getTime()) / (1000 * 3600 * 24);
        return daysDiff >= 0 && daysDiff <= 7; // Due within next 7 days
      }).length;
      
      // Load meetings data for stats
      let totalMeetings = 0;
      let upcomingMeetings = 0;
      try {
        const meetings = await ploneAPI.getMeetings(classData.id);
        totalMeetings = meetings.length;
        const now = new Date();
        upcomingMeetings = meetings.filter(m => {
          const meetingDate = new Date(m.startTime);
          return meetingDate > now;
        }).length;
      } catch (error) {
        console.error('Error loading meetings for stats:', error);
      }
      
      setClassStats({
        totalAssignments: assignmentsData.length,
        completedAssignments: completed,
        averageGrade,
        upcomingDeadlines: upcoming,
        totalMeetings,
        upcomingMeetings
      });
    } catch (error: any) {
      console.error('Failed to load assignments:', error);
      toast({
        title: "Error",
        description: "Failed to load assignments. Please try again.",
        variant: "destructive"
      });
    } finally {
      setAssignmentsLoading(false);
    }
  };

  useEffect(() => {
    if (open && classData) {
      loadAssignments();
    }
  }, [open, classData, studentUsername]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'graded':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'submitted':
        return <Clock className="w-4 h-4 text-blue-600" />;
      case 'pending':
        return <Circle className="w-4 h-4 text-gray-400" />;
      default:
        return <Circle className="w-4 h-4 text-gray-400" />;
    }
  };

  const getGradeColor = (grade: number) => {
    if (grade >= 90) return 'text-green-600';
    if (grade >= 80) return 'text-blue-600';
    if (grade >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const isOverdue = (dueDate: string, status: string) => {
    if (status !== 'pending') return false;
    return new Date(dueDate) < new Date();
  };

  if (!classData) return null;

  const progressPercentage = classStats.totalAssignments > 0 
    ? (classStats.completedAssignments / classStats.totalAssignments) * 100 
    : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start gap-4 pr-8">
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-xl flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-blue-600" />
                <span className="truncate">{classData.title}</span>
              </DialogTitle>
              <DialogDescription className="mt-1">
                {classData.description || `${classData.subject} • ${classData.grade_level || classData.gradeLevel}`}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="assignments">Assignments</TabsTrigger>
            <TabsTrigger value="meetings">Meetings</TabsTrigger>
            <TabsTrigger value="progress">Progress</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6 min-h-[400px]">
            {/* Class Information */}
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <GraduationCap className="w-5 h-5" />
                  Class Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <User className="w-4 h-4 text-gray-500" />
                      <div>
                        <p className="text-sm font-medium">Instructor</p>
                        <p className="text-sm text-gray-600">{classData.teacher || 'Not specified'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <BookOpen className="w-4 h-4 text-gray-500" />
                      <div>
                        <p className="text-sm font-medium">Subject</p>
                        <p className="text-sm text-gray-600">{classData.subject || 'Not specified'}</p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Target className="w-4 h-4 text-gray-500" />
                      <div>
                        <p className="text-sm font-medium">Grade Level</p>
                        <p className="text-sm text-gray-600">{classData.grade_level || classData.gradeLevel || 'Not specified'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Calendar className="w-4 h-4 text-gray-500" />
                      <div>
                        <p className="text-sm font-medium">Schedule</p>
                        <p className="text-sm text-gray-600">{classData.schedule || 'Not specified'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <Card>
                <CardContent className="p-4 text-center">
                  <FileText className="w-8 h-8 mx-auto mb-2 text-blue-600" />
                  <p className="text-2xl font-bold">{classStats.totalAssignments}</p>
                  <p className="text-sm text-gray-600">Total Assignments</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-600" />
                  <p className="text-2xl font-bold">{classStats.completedAssignments}</p>
                  <p className="text-sm text-gray-600">Completed</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <Award className="w-8 h-8 mx-auto mb-2 text-yellow-600" />
                  <p className={`text-2xl font-bold ${getGradeColor(classStats.averageGrade)}`}>
                    {classStats.averageGrade > 0 ? `${classStats.averageGrade.toFixed(1)}%` : '--'}
                  </p>
                  <p className="text-sm text-gray-600">Average Grade</p>
                </CardContent>
              </Card>
                              <Card>
                  <CardContent className="p-4 text-center">
                    <AlertCircle className="w-8 h-8 mx-auto mb-2 text-orange-600" />
                    <p className="text-2xl font-bold">{classStats.upcomingDeadlines}</p>
                    <p className="text-sm text-gray-600">Due This Week</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <Video className="w-8 h-8 mx-auto mb-2 text-purple-600" />
                    <p className="text-2xl font-bold">{classStats.totalMeetings}</p>
                    <p className="text-sm text-gray-600">Total Meetings</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <Calendar className="w-8 h-8 mx-auto mb-2 text-indigo-600" />
                    <p className="text-2xl font-bold">{classStats.upcomingMeetings}</p>
                    <p className="text-sm text-gray-600">Upcoming</p>
                  </CardContent>
                </Card>
              </div>

            {/* Progress Overview */}
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Overall Progress
                </h3>
                <div className="space-y-4">
                  <div className="flex justify-between text-sm">
                    <span>Assignment Completion</span>
                    <span className="font-medium">
                      {classStats.completedAssignments}/{classStats.totalAssignments} 
                      ({progressPercentage.toFixed(0)}%)
                    </span>
                  </div>
                  <Progress value={progressPercentage} className="h-3" />
                  <p className="text-sm text-gray-600">
                    You have completed {classStats.completedAssignments} out of {classStats.totalAssignments} assignments in this class.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="assignments" className="space-y-4 min-h-[400px]">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Your Assignments</h3>
              {assignmentsLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            </div>

            {assignmentsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : assignments.length === 0 ? (
              <Card>
                <CardContent className="text-center py-8">
                  <FileText className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p className="text-gray-600">No assignments available yet</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {assignments.map((assignment) => (
                  <Card key={assignment.id} className={`${
                    assignment.dueDate && isOverdue(assignment.dueDate, assignment.status) 
                      ? 'border-red-200 bg-red-50' 
                      : ''
                  }`}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          {getStatusIcon(assignment.status)}
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium truncate">{assignment.title}</h4>
                            {assignment.description && (
                              <p className="text-sm text-gray-600 truncate">{assignment.description}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-4 flex-shrink-0">
                          {assignment.grade !== undefined && assignment.grade !== null && (
                            <div className="text-right">
                              <p className={`font-bold ${getGradeColor(assignment.grade)}`}>
                                {assignment.grade}%
                              </p>
                              <p className="text-xs text-gray-500">Grade</p>
                            </div>
                          )}
                          {assignment.dueDate && (
                            <div className="text-right">
                              <p className={`text-sm ${
                                isOverdue(assignment.dueDate, assignment.status) 
                                  ? 'text-red-600 font-medium' 
                                  : 'text-gray-600'
                              }`}>
                                {formatDate(assignment.dueDate)}
                              </p>
                              <p className="text-xs text-gray-500">
                                {isOverdue(assignment.dueDate, assignment.status) ? 'Overdue' : 'Due'}
                              </p>
                            </div>
                          )}
                          <Badge 
                            variant={
                              assignment.status === 'graded' ? 'default' :
                              assignment.status === 'submitted' ? 'secondary' : 
                              'outline'
                            }
                          >
                            {assignment.status === 'graded' ? 'Graded' :
                             assignment.status === 'submitted' ? 'Submitted' : 
                             'Pending'}
                          </Badge>
                        </div>
                      </div>
                      {assignment.feedback && assignment.status === 'graded' && (
                        <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                          <p className="text-sm font-medium text-blue-900 mb-1">Instructor Feedback:</p>
                          <p className="text-sm text-blue-800">{assignment.feedback}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="meetings" className="space-y-4 min-h-[400px]">
            <StudentMeetingsTab classId={classData?.id || ''} />
          </TabsContent>

          <TabsContent value="progress" className="space-y-6 min-h-[400px]">
            {/* Detailed Progress */}
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-4">Assignment Progress</h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold text-green-600">{classStats.completedAssignments}</p>
                      <p className="text-sm text-gray-600">Completed</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-yellow-600">
                        {assignments.filter(a => a.status === 'pending').length}
                      </p>
                      <p className="text-sm text-gray-600">Pending</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-red-600">
                        {assignments.filter(a => a.dueDate && isOverdue(a.dueDate, a.status)).length}
                      </p>
                      <p className="text-sm text-gray-600">Overdue</p>
                    </div>
                  </div>
                  <Progress value={progressPercentage} className="h-3" />
                </div>
              </CardContent>
            </Card>

            {/* Grade Distribution */}
            {assignments.filter(a => a.grade !== undefined && a.grade !== null).length > 0 && (
              <Card>
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold mb-4">Grade Summary</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span>Current Average</span>
                      <span className={`font-bold ${getGradeColor(classStats.averageGrade)}`}>
                        {classStats.averageGrade.toFixed(1)}%
                      </span>
                    </div>
                    <div className="text-sm text-gray-600">
                      Based on {assignments.filter(a => a.grade !== undefined && a.grade !== null).length} graded assignments
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Upcoming Deadlines */}
            {classStats.upcomingDeadlines > 0 && (
              <Card>
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold mb-4">Upcoming Deadlines</h3>
                  <div className="space-y-2">
                    {assignments
                      .filter(a => {
                        if (!a.dueDate || a.status !== 'pending') return false;
                        const dueDate = new Date(a.dueDate);
                        const now = new Date();
                        const daysDiff = (dueDate.getTime() - now.getTime()) / (1000 * 3600 * 24);
                        return daysDiff >= 0 && daysDiff <= 7;
                      })
                      .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
                      .map(assignment => (
                        <div key={assignment.id} className="flex justify-between items-center p-3 bg-orange-50 rounded-lg">
                          <span className="font-medium">{assignment.title}</span>
                          <span className="text-sm text-orange-600">
                            Due {formatDate(assignment.dueDate!)}
                          </span>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// Student meetings component (reuses teacher layout but student-appropriate actions)
function StudentMeetingsTab({ classId }: { classId: string }) {
  const [meetings, setMeetings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMeetings();
  }, [classId]);

  const loadMeetings = async () => {
    if (!classId) return;
    
    try {
      setLoading(true);
      const classMeetings = await ploneAPI.getMeetings(classId);
      setMeetings(classMeetings);
    } catch (error) {
      console.error('Error loading meetings:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (meetings.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Class Meetings (0)</h3>
        </div>
        
        <Card>
          <CardContent className="p-6 text-center">
            <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="font-semibold text-gray-900 mb-2">No Meetings Scheduled</h3>
            <p className="text-sm text-gray-600 mb-4">
              Your instructor hasn't scheduled any virtual meetings for this class yet.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Class Meetings ({meetings.length})</h3>
        {/* Students don't get the create meeting button or bulk actions */}
      </div>
      
      <div className="grid gap-4">
        {meetings.map((meeting, index) => {
          const meetingDate = new Date(meeting.startTime);
          const isOld = meetingDate < new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // Older than 7 days
          const isPast = meetingDate < new Date();
          
          return (
            <Card key={meeting.id || index} className={isOld ? "border-orange-200 bg-orange-50/30" : ""}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium">{meeting.title}</h4>
                      {isOld && <Badge variant="outline" className="text-orange-600 border-orange-200">Old</Badge>}
                      {isPast && meeting.status === 'scheduled' && <Badge variant="outline" className="text-gray-500">Past</Badge>}
                    </div>
                    <p className="text-sm text-gray-600">{meeting.description}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {meetingDate.toLocaleString()}
                      </div>
                      <div>{meeting.duration} minutes</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={meeting.status === 'scheduled' ? 'default' : 'secondary'}>
                      {meeting.status}
                    </Badge>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => {
                        window.open(`/meeting/${meeting.id}?classId=${classId}`, '_blank');
                      }}
                    >
                      Join
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            window.open(`/classes/${classId}/meetings/${meeting.id}/recordings`, '_blank');
                          }}
                        >
                          <Video className="w-4 h-4 mr-2" />
                          View Recordings
                        </DropdownMenuItem>
                        {/* Students don't get delete option */}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
} 