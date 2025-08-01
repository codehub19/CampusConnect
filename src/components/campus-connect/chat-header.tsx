
"use client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Gamepad2, Phone, Video, MoreVertical, X } from "lucide-react";
import type { User } from "@/lib/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface ChatHeaderProps {
  partner: User;
  onGameClick: () => void;
  onVideoCallClick: () => void;
  onLeaveChat: () => void;
  onBlockUser: () => void;
}

export default function ChatHeader({ partner, onGameClick, onVideoCallClick, onLeaveChat, onBlockUser }: ChatHeaderProps) {
  return (
    <div className="flex items-center justify-between p-4 border-b">
      <div className="flex items-center gap-4">
        <Avatar>
          <AvatarImage src={partner.avatar} alt={partner.name} />
          <AvatarFallback>{partner.name.charAt(0)}</AvatarFallback>
        </Avatar>
        <div>
          <h2 className="font-semibold text-lg">{partner.name}</h2>
          <div className="flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded-full ${partner.online ? 'bg-green-500' : 'bg-gray-400'}`}></span>
            <p className="text-sm text-muted-foreground">{partner.online ? 'Online' : 'Offline'}</p>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={onGameClick}>
          <Gamepad2 className="h-5 w-5" />
          <span className="sr-only">Play a game</span>
        </Button>
        <Button variant="ghost" size="icon" onClick={onVideoCallClick}>
          <Video className="h-5 w-5" />
          <span className="sr-only">Start video call</span>
        </Button>
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                    <MoreVertical className="h-5 w-5" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
                <DropdownMenuItem onSelect={onBlockUser} className="text-destructive">Block User</DropdownMenuItem>
                <DropdownMenuItem onSelect={onLeaveChat}>Leave Chat</DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
