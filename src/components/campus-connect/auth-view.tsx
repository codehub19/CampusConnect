
"use client";

import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { Label } from '../ui/label';

const GoogleIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 48 48">
        <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24s8.955,20,20,20s20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"></path>
        <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"></path>
        <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"></path>
        <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571l6.19,5.238C44.438,36.338,48,31,48,24C48,22.659,47.862,21.35,47.611,20.083z"></path>
    </svg>
);

interface AuthViewProps {
    onlineCount: number | null;
}

export default function AuthView({ onlineCount }: AuthViewProps) {
    const [view, setView] = useState('options'); // 'options', 'signup', 'login', 'forgot_password'
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { signInWithGoogle, signUpWithEmail, signInWithEmail, sendPasswordReset } = useAuth();
    const { toast } = useToast();

    const handleAuthAction = async (action: Function, ...args: any[]) => {
        setIsLoading(true);
        try {
            await action(...args);
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Authentication Failed',
                description: error.message,
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handlePasswordReset = async () => {
        if (!email) {
            toast({
                variant: 'destructive',
                title: 'Email Required',
                description: 'Please enter your email address to reset your password.',
            });
            return;
        }
        await handleAuthAction(sendPasswordReset, email);
        setView('login'); // Go back to login view after sending email
    };

    const renderContent = () => {
        switch (view) {
            case 'forgot_password':
                return (
                    <div>
                        <h2 className="text-2xl font-bold mb-4 text-white">Reset Password</h2>
                        <p className="text-muted-foreground mb-4 text-sm">Enter your email and we'll send you a link to get back into your account.</p>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="reset-email">Email</Label>
                                <Input id="reset-email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="bg-secondary border-border" />
                            </div>
                            <Button onClick={handlePasswordReset} className="w-full" disabled={isLoading}>
                               {isLoading ? <Loader2 className="animate-spin" /> : 'Send Reset Link'}
                           </Button>
                        </div>
                        <Button variant="link" onClick={() => setView('login')} className="w-full mt-4 text-muted-foreground">Back to Log In</Button>
                    </div>
                );
            case 'signup':
                return (
                    <div>
                        <h2 className="text-2xl font-bold mb-4 text-white">Create Account</h2>
                        <div className="space-y-4">
                            <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="bg-secondary border-border" />
                            <Input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="bg-secondary border-border"/>
                            <Button onClick={() => handleAuthAction(signUpWithEmail, email, password)} className="w-full" disabled={isLoading}>
                                {isLoading ? <Loader2 className="animate-spin" /> : 'Sign Up'}
                            </Button>
                        </div>
                        <Button variant="link" onClick={() => setView('options')} className="w-full mt-4 text-muted-foreground">Back</Button>
                    </div>
                );
            case 'login':
                return (
                     <div>
                        <h2 className="text-2xl font-bold mb-4 text-white">Log In</h2>
                        <div className="space-y-4">
                            <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="bg-secondary border-border" />
                            <Input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="bg-secondary border-border" />
                            <Button onClick={() => handleAuthAction(signInWithEmail, email, password)} className="w-full" disabled={isLoading}>
                               {isLoading ? <Loader2 className="animate-spin" /> : 'Log In'}
                           </Button>
                           <div className="text-right">
                            <Button variant="link" onClick={() => setView('forgot_password')} className="text-sm p-0 h-auto text-muted-foreground hover:text-primary">Forgot Password?</Button>
                           </div>
                        </div>
                        <Button variant="link" onClick={() => setView('options')} className="w-full mt-4 text-muted-foreground">Back</Button>
                    </div>
                );
            case 'options':
            default:
                return (
                    <div>
                        <h2 className="text-3xl font-bold mb-2 text-center text-white">CampusConnect</h2>
                        <p className="text-center text-muted-foreground mb-6">Connect with fellow students!</p>
                        
                        <div className="space-y-4">
                            <Button onClick={() => handleAuthAction(signInWithGoogle)} className="w-full bg-white text-gray-800 font-bold hover:bg-gray-200" disabled={isLoading}>
                                {isLoading ? <Loader2 className="animate-spin" /> : <><GoogleIcon /> Sign in with Google</>}
                            </Button>
                             <div className="relative flex py-2 items-center">
                                <div className="flex-grow border-t border-border"></div>
                                <span className="flex-shrink mx-4 text-muted-foreground text-sm">OR</span>
                                <div className="flex-grow border-t border-border"></div>
                            </div>
                            <Button onClick={() => setView('signup')} className="w-full font-bold" disabled={isLoading}>
                                Sign Up with Email
                            </Button>
                        </div>
                         <p className="text-center mt-6 text-muted-foreground">Already have an account? <Button variant="link" onClick={() => setView('login')} className="font-semibold text-primary p-0 h-auto">Log In</Button></p>
                    </div>
                );
        }
    }

    return (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-40 p-4">
            <div className="bg-card/80 border border-border rounded-2xl shadow-2xl p-8 max-w-sm w-full">
                {renderContent()}
            </div>
        </div>
    );
}
