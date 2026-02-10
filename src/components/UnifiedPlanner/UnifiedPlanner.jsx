// HomePlannerSection.jsx
import { useEffect, useState } from "react";
import {
    Box,
    Card,
    Chip,
    Grid,
    Typography,
    Divider,
    Button,
} from "@mui/material";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
// הוספת הייבוא החסר כדי למנוע קריסה
import interactionPlugin from "@fullcalendar/interaction";
import { supabase } from "lib/supabaseClient";
import { format } from "date-fns";
import { he } from "date-fns/locale";

/* ---------- Status UI config ---------- */
const statusColors = {
    open: "info",
    in_progress: "warning",
    late: "error",
    done: "success",
};

const statusLabels = {
    open: "פתוחה",
    in_progress: "בתהליך",
    late: "באיחור",
    done: "הושלמה",
};

const getTaskStatus = (isTaskDone, taskDueDate) => {
    if (isTaskDone) return "done";
    if (!taskDueDate) return "open";
    const today = new Date();
    const due = new Date(taskDueDate);
    return due < today ? "late" : "in_progress";
};

export default function UnifiedPlanner() {
    const [missions, setMissions] = useState([]);
    const [googleConnected, setGoogleConnected] = useState(false);

    useEffect(() => {
        const fetchUserTasks = async () => {
            const { data: authData, error } = await supabase.auth.getUser();
            if (error || !authData?.user) return;

            const { data, error: error2 } = await supabase
                .from("tasks")
                .select(`id, title, due_date, is_done`)
                .eq("assignee_id", authData.user.id)
                .order("due_date", { ascending: true });

            if (error2) {
                console.error("Error fetching tasks:", error2);
                return;
            }

            const mappedTasks = data.map((task) => ({
                id: task.id,
                title: task.title,
                due_date: task.due_date,
                status: getTaskStatus(task.is_done, task.due_date),
            }));

            setMissions(mappedTasks);
        };

        fetchUserTasks();
    }, []);

    const calendarEvents = missions.map((m) => ({
        id: `mission-${m.id}`,
        title: `📝 ${m.title}`,
        start: m.due_date, // FullCalendar מעדיף 'start' על 'date'
        color: m.status === "late" ? "#f87171" : "#6366f1",
    }));

    const connectGoogleCalendar = async () => {
        window.location.href = "/functions/google-calendar-auth";
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return "ללא תאריך";
        const d = new Date(dateStr);
        return format(d, "dd/MM/yyyy HH:mm", { locale: he });
    };

    return (
        <Box mt={5} dir="rtl">
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                <Typography variant="h5" fontWeight={700}>
                    🗓️ יומן ומשימות
                </Typography>

                {!googleConnected && (
                    <Button variant="outlined" onClick={connectGoogleCalendar}>
                        חיבור ליומן Google
                    </Button>
                )}
            </Box>

            <Grid container spacing={4}>
                <Grid item xs={12} md={5}>
                    <Card sx={{ p: 3, bgcolor: "#f3f4f6" }}>
                        <Typography fontWeight={700} mb={2}>
                            משימות קרובות
                        </Typography>

                        {missions.length === 0 && (
                            <Typography color="text.secondary">
                                אין משימות פעילות 🎉
                            </Typography>
                        )}

                        {missions.map((m, i) => (
                            <Box key={m.id}>
                                <Box
                                    display="flex"
                                    alignItems="center"
                                    justifyContent="space-between"
                                    py={1.5}
                                    sx={{
                                        borderRight: `4px solid ${m.status === "late"
                                            ? "#f87171"
                                            : m.status === "done"
                                                ? "#34d399"
                                                : m.status === "in_progress"
                                                    ? "#facc15"
                                                    : "#60a5fa"
                                            }`,
                                        pr: 2, // שינוי ל-Padding Right עבור RTL
                                    }}
                                >
                                    <Typography fontWeight={500}>{m.title}</Typography>

                                    <Box display="flex" gap={1.5} alignItems="center">
                                        <Chip
                                            size="small"
                                            label={statusLabels[m.status]}
                                            color={statusColors[m.status]}
                                        />
                                        <Typography fontSize={13} color="text.secondary">
                                            {formatDate(m.due_date)}
                                        </Typography>
                                    </Box>
                                </Box>
                                {i < missions.length - 1 && <Divider sx={{ my: 1 }} />}
                            </Box>
                        ))}
                    </Card>
                </Grid>


                <Grid item xs={12} md={7}>
                    <Card sx={{ p: 2, bgcolor: "#f8fafc" }}>
                        {/* Box עוטף להזרקת תיקוני CSS עבור יישור המספרים לימין */}
                        <Box sx={{
                            '& .fc-daygrid-day-top': {
                                flexDirection: 'row-reverse !important', // הופך את סדר האלמנטים בראש התא
                            },
                            '& .fc-daygrid-day-number': {
                                width: '100%',
                                textAlign: 'right !important',
                                padding: '8px !important',
                                fontSize: '0.9rem',
                                fontWeight: 500,
                                color: '#64748b'
                            },
                            // תיקון אופציונלי להדגשת היום הנוכחי (העיגול/צבע)
                            '& .fc-day-today': {
                                bgcolor: 'rgba(99, 102, 241, 0.04) !important',
                            }
                        }}>
                            <FullCalendar
                                plugins={[dayGridPlugin, interactionPlugin]}
                                initialView="dayGridMonth"
                                events={calendarEvents}
                                height="auto"
                                locale="he"
                                direction="rtl"
                                firstDay={0}
                                buttonText={{
                                    today: 'היום',
                                    month: 'חודש',
                                    week: 'שבוע',
                                    day: 'יום',
                                    list: 'סדר יום'
                                }}
                                headerToolbar={{
                                    end: 'today prev,next',
                                    center: 'title',
                                    start: 'dayGridMonth,dayGridWeek'
                                }}
                            />
                        </Box>
                    </Card>
                </Grid>
            </Grid>
        </Box>
    );
}