"use client"

import { useParams, useSearchParams } from "next/navigation"
import { SimpleMeetingRoom } from "@/components/simple-meeting-room"
import { useAuth } from "@/lib/auth"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2 } from "lucide-react"

export default function MeetingRoomPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const { user } = useAuth()
  
  const meetingId = params.meetingId as string
  const classId = searchParams.get('classId') || undefined
  
  // Check if user is a teacher (has elevated roles)
  const isTeacher = user?.roles?.some((role: string) => 
    ['Manager', 'Site Administrator', 'Editor', 'Contributor'].includes(role)
  ) || false

  if (!user) {
    return (
      <div className="container mx-auto p-8">
        <Card>
          <CardContent className="p-6 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
            <p>Loading meeting room...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-4">
      <SimpleMeetingRoom 
        meetingId={meetingId}
        classId={classId}
        isTeacher={isTeacher}
      />
    </div>
  )
} 