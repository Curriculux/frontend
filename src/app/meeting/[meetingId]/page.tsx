"use client"

import { useParams, useSearchParams } from "next/navigation"
import { useState, useEffect } from "react"
import { SimpleMeetingRoom } from "@/components/simple-meeting-room"
import { useAuth } from "@/lib/auth"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2 } from "lucide-react"
import { ploneAPI } from "@/lib/api"

export default function MeetingRoomPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const [isHost, setIsHost] = useState(false)
  const [loadingHost, setLoadingHost] = useState(true)
  
  const meetingId = params.meetingId as string
  const classId = searchParams.get('classId') || undefined

  // Check if current user is the meeting host (creator)
  useEffect(() => {
    const checkHostStatus = async () => {
      if (user && meetingId) {
        try {
          const hostStatus = await ploneAPI.isMeetingHost(meetingId, classId)
          setIsHost(hostStatus)
        } catch (error) {
          console.error('Error checking host status:', error)
          setIsHost(false)
        }
      }
      setLoadingHost(false)
    }

    checkHostStatus()
  }, [user, meetingId, classId])

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

  if (loadingHost) {
    return (
      <div className="container mx-auto p-8">
        <Card>
          <CardContent className="p-6 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
            <p>Checking meeting permissions...</p>
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
        isTeacher={isHost}
      />
    </div>
  )
} 