"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { RefreshCw, CheckCircle, AlertTriangle, Settings } from "lucide-react"
import { ploneAPI } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"

interface AuditResult {
  totalMeetings: number;
  documentMeetings: number;
  folderMeetings: number;
  issues: Array<{ meetingId: string; classId?: string; issue: string }>;
}

export function MeetingAuditPanel() {
  const { toast } = useToast()
  const [auditResult, setAuditResult] = useState<AuditResult | null>(null)
  const [isAuditing, setIsAuditing] = useState(false)
  const [isFixing, setIsFixing] = useState(false)
  const [fixProgress, setFixProgress] = useState(0)

  const runAudit = async () => {
    setIsAuditing(true)
    try {
      const result = await ploneAPI.auditMeetingsForRecording()
      setAuditResult(result)
      
      if (result.documentMeetings > 0) {
        toast({
          title: "Issues Found",
          description: `Found ${result.documentMeetings} meetings that cannot support recordings`,
          variant: "destructive",
        })
      } else {
        toast({
          title: "All Good!",
          description: "All meetings are properly configured for recordings",
        })
      }
    } catch (error) {
      console.error('Audit failed:', error)
      toast({
        title: "Audit Failed",
        description: "Could not complete meeting audit",
        variant: "destructive",
      })
    } finally {
      setIsAuditing(false)
    }
  }

  const fixMeetingStructures = async () => {
    if (!auditResult || auditResult.issues.length === 0) return

    setIsFixing(true)
    setFixProgress(0)
    
    const totalIssues = auditResult.issues.length
    let fixed = 0
    let errors = 0

    for (let i = 0; i < auditResult.issues.length; i++) {
      const issue = auditResult.issues[i]
      
      try {
        // Get the existing meeting data
        const existingMeeting = await ploneAPI.getMeeting(issue.meetingId, issue.classId)
        
        // Delete the old Document-type meeting
        await ploneAPI.deleteMeeting(issue.meetingId, issue.classId)
        
        // Recreate as Folder-type meeting with same data
        await ploneAPI.createMeeting({
          title: existingMeeting.title,
          description: existingMeeting.description,
          startTime: existingMeeting.startTime,
          duration: existingMeeting.duration,
          meetingType: existingMeeting.meetingType,
          classId: existingMeeting.classId,
          autoRecord: existingMeeting.autoRecord,
        })
        
        fixed++
        console.log(`Fixed meeting ${issue.meetingId}`)
      } catch (error) {
        console.error(`Failed to fix meeting ${issue.meetingId}:`, error)
        errors++
      }
      
      setFixProgress(Math.round(((i + 1) / totalIssues) * 100))
    }

    setIsFixing(false)
    setFixProgress(0)
    
    // Re-run audit to show updated results
    await runAudit()
    
    toast({
      title: "Migration Complete",
      description: `Fixed ${fixed} meetings${errors > 0 ? `, ${errors} errors` : ''}`,
      variant: errors > 0 ? "destructive" : "default",
    })
  }

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Meeting Recording Audit
        </CardTitle>
        <CardDescription>
          Check and fix meetings that cannot support recordings due to structural issues
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button 
            onClick={runAudit} 
            disabled={isAuditing || isFixing}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isAuditing ? 'animate-spin' : ''}`} />
            {isAuditing ? 'Auditing...' : 'Run Audit'}
          </Button>
          
          {auditResult && auditResult.issues.length > 0 && (
            <Button 
              onClick={fixMeetingStructures}
              disabled={isFixing || isAuditing}
              variant="destructive"
            >
              Fix {auditResult.issues.length} Issues
            </Button>
          )}
        </div>

        {isFixing && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Fixing meetings...</span>
              <span>{fixProgress}%</span>
            </div>
            <Progress value={fixProgress} className="w-full" />
          </div>
        )}

        {auditResult && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{auditResult.totalMeetings}</div>
                <div className="text-sm text-muted-foreground">Total Meetings</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{auditResult.folderMeetings}</div>
                <div className="text-sm text-muted-foreground">Recording Ready</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{auditResult.documentMeetings}</div>
                <div className="text-sm text-muted-foreground">Need Fixing</div>
              </div>
            </div>

            {auditResult.issues.length > 0 ? (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-2">
                    <p className="font-semibold">Found {auditResult.issues.length} meetings that cannot support recordings:</p>
                    <div className="space-y-1">
                      {auditResult.issues.slice(0, 5).map((issue, index) => (
                        <div key={index} className="flex items-center gap-2 text-sm">
                          <Badge variant="outline">{issue.meetingId}</Badge>
                          <span className="text-muted-foreground">in class {issue.classId}</span>
                        </div>
                      ))}
                      {auditResult.issues.length > 5 && (
                        <p className="text-sm text-muted-foreground">...and {auditResult.issues.length - 5} more</p>
                      )}
                    </div>
                  </div>
                </AlertDescription>
              </Alert>
            ) : (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  All meetings are properly configured and can support recordings!
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
} 