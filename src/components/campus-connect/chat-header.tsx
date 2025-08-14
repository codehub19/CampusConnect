
"use client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Gamepad2, Phone, Video, MoreVertical, UserPlus, Check } from "lucide-react";
import type { User } from "@/lib/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAuth } from "@/hooks/use-auth";
import { addDoc, collection, doc, getFirestore, setDoc, serverTimestamp } from "firebase/firestore";
import { firebaseApp } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";


interface ChatHeaderProps {
  partner: User;
  onGameClick: () => void;
  onVideoCallClick: () => void;
  onLeaveChat: () => void;
  onBlockUser: () => void;
}

export default function ChatHeader({ partner, onGameClick, onVideoCallClick, onLeaveChat, onBlockUser }: ChatHeaderProps) {
  const { user, profile } = useAuth();
  const db = getFirestore(firebaseApp);
  const { toast } = useToast();

  const isFriend = profile?.friends?.includes(partner.id);
  
  const handleAddFriend = async () => {
    if (!user || !partner || isFriend) return;
    const requestId = [user.uid, partner.id].sort().join('_');
    const requestRef = doc(db, "friend_requests", requestId);

    try {
      await setDoc(requestRef, {
        fromId: user.uid,
        toId: partner.id,
        fromName: profile?.name,
        status: 'pending',
        timestamp: serverTimestamp(),
      });
      toast({title: "Friend request sent!"});
    } catch(e) {
      console.error(e);
      toast({variant: 'destructive', title: 'Error sending request.'});
    }
  }

  return (
    <>
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
      <div className="flex items-center gap-1">
        {!isFriend && (
            <Button variant="ghost" size="icon" onClick={handleAddFriend} title="Add Friend">
                <UserPlus className="h-5 w-5" />
            </Button>
        )}
        {isFriend && (
             <div className="flex items-center gap-1 text-sm text-muted-foreground mr-2" title="You are friends">
                <Check className="h-5 w-5 text-green-500" />
                <span>Friends</span>
            </div>
        )}
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
    </>
  );
}
