import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { supabase } from 'lib/supabaseClient';

const LogoutPage = () => {
    const navigate = useNavigate();

    useEffect(() => {
        const logout = async () => {
            await supabase.auth.signOut();
            navigate('/Login');
        };

        logout();
    }, [navigate]);
    return (
        <div>
            <h1>Logging out...</h1>
        </div>
    );
};

export default LogoutPage;