"use client"

import * as React from "react"
import { format } from "date-fns"
import { Calendar as CalendarIcon, Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface DateTimePickerProps {
  value?: string
  onChange?: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function DateTimePicker({
  value,
  onChange,
  placeholder = "Pick a date and time",
  disabled = false,
  className
}: DateTimePickerProps) {
  const [open, setOpen] = React.useState(false)
  const [date, setDate] = React.useState<Date | undefined>(
    value ? new Date(value) : undefined
  )
  const [timeValue, setTimeValue] = React.useState<string>(
    value ? format(new Date(value), "HH:mm") : "23:59"
  )

  // Update internal state when value prop changes
  React.useEffect(() => {
    if (value) {
      const newDate = new Date(value)
      setDate(newDate)
      setTimeValue(format(newDate, "HH:mm"))
    } else {
      setDate(undefined)
      setTimeValue("23:59")
    }
  }, [value])

  const handleDateSelect = (selectedDate: Date | undefined) => {
    if (selectedDate) {
      const [hours, minutes] = timeValue.split(":").map(Number)
      selectedDate.setHours(hours, minutes, 0, 0)
      setDate(selectedDate)
      
      // Format as ISO string for datetime-local input compatibility
      const isoString = selectedDate.toISOString().slice(0, 16)
      onChange?.(isoString)
    } else {
      setDate(undefined)
      onChange?.("")
    }
  }

  const handleTimeChange = (newTime: string) => {
    setTimeValue(newTime)
    if (date) {
      const [hours, minutes] = newTime.split(":").map(Number)
      const newDate = new Date(date)
      newDate.setHours(hours, minutes, 0, 0)
      setDate(newDate)
      
      const isoString = newDate.toISOString().slice(0, 16)
      onChange?.(isoString)
    }
  }

  const handleClear = () => {
    setDate(undefined)
    setTimeValue("23:59")
    onChange?.("")
    setOpen(false)
  }

  const displayValue = date 
    ? `${format(date, "PPP")} at ${format(date, "h:mm a")}`
    : ""

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-full justify-start text-left font-normal",
              !date && "text-muted-foreground"
            )}
            disabled={disabled}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {displayValue || placeholder}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="flex">
            <Calendar
              mode="single"
              selected={date}
              onSelect={handleDateSelect}
              disabled={(date) =>
                date < new Date(new Date().setHours(0, 0, 0, 0))
              }
              initialFocus
            />
            <div className="flex flex-col gap-2 px-3 py-4 border-l">
              <Label htmlFor="time" className="text-sm font-medium">
                Time
              </Label>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <Input
                  id="time"
                  type="time"
                  value={timeValue}
                  onChange={(e) => handleTimeChange(e.target.value)}
                  className="w-32"
                />
              </div>
              
              {/* Quick time presets */}
              <div className="grid grid-cols-2 gap-1 mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleTimeChange("09:00")}
                  className="text-xs"
                >
                  9:00 AM
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleTimeChange("12:00")}
                  className="text-xs"
                >
                  12:00 PM
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleTimeChange("17:00")}
                  className="text-xs"
                >
                  5:00 PM
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleTimeChange("23:59")}
                  className="text-xs"
                >
                  11:59 PM
                </Button>
              </div>

              <div className="flex gap-2 mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClear}
                  className="flex-1"
                >
                  Clear
                </Button>
                <Button
                  size="sm"
                  onClick={() => setOpen(false)}
                  className="flex-1"
                >
                  Done
                </Button>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
} 