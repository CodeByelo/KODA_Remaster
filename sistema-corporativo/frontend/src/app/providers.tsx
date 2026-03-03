import { AuthProvider } from "../context/AuthContext";
import { SecurityProtector } from "../components/SecurityProtector";
import { SystemDialogHost } from "../lib/ui-dialog";

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <AuthProvider>
            <SecurityProtector>
                {children}
                <SystemDialogHost />
            </SecurityProtector>
        </AuthProvider>
    );
}
