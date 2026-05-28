import React, { createContext, useContext, useState, useCallback } from "react";

type Language = "en" | "sv";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const translations: Record<Language, Record<string, string>> = {
  en: {
    // Header
    "header.dataAnalysis": "ITS Data Analysis",
    "header.reportDate": "Report Date:",
    "header.author": "Author:",
    "header.period": "Period:",
    
    // Hero Section
    "hero.draft": "DRAFT - Analysis Report",
    "hero.title": "Analysis of ITS Data",
    "hero.description": "Based on the {sessions} effective charging sessions in the dataset ({zero} zero-charge attempts excluded), we have analyzed total charge added, average charging speed and session duration across {vehicles} vehicles and {chargers} chargers.",
    "hero.batteryInfo": "TT (terminal truck) battery capacity: 236 kWh",
    "spec.title": "Vehicle Specification",
    "spec.subtitle": "Reference values used across all kWh calculations",
    "spec.batteryCapacity": "TT Battery Capacity",
    "spec.kwhPerSoc": "Per 1% SoC",
    "spec.kwhPerSocTooltip": "Derived from 236 kWh ÷ 100 = 2.36 kWh per 1% SoC. This conversion factor is applied to every charging session to translate %SoC into kWh.",
    "table.kwhCharged": "kWh Charged",
    "table.summary.totalSessions": "Total Sessions",
    "table.summary.totalKwh": "Total kWh Charged",
    "table.summary.avgKwh": "Avg kWh per Session",
    "breakdown.title.vehicle": "kWh Charged per Vehicle",
    "breakdown.title.charger": "kWh Charged per Charger",
    "breakdown.subtitle": "Total kWh charged based on active filters",
    "breakdown.export": "Export kWh Breakdown (CSV)",
    
    // Metrics
    "metrics.totalCharge": "Total Charge Added",
    "metrics.totalSessions": "Total Sessions",
    "metrics.avgChargingSpeed": "Avg Charging Speed",
    "metrics.avgSessionTime": "Avg Session Time",
    "metrics.fromVehicles": "From {count} vehicles",
    "metrics.chargingSessions": "Charging sessions",
    "metrics.perMinute": "%SoC per minute",
    "metrics.minutes": "{value} min",
    "metrics.totalEnergyReceived": "Total Energy Received",
    "metrics.vehicleSessions": "From {count} vehicle sessions",
    
    // Data source indicator
    "dataSource.showing": "Showing data for last {days} days ({sessions} sessions). Select \"All Data\" for complete report data.",
    
    // Vehicle Selector
    "vehicleSelector.selectVehicles": "Select Vehicles",
    "vehicleSelector.allVehicles": "All Vehicles",
    
    // Date Range
    "dateRange.7days": "7 Days",
    "dateRange.14days": "14 Days",
    "dateRange.30days": "30 Days",
    "dateRange.allData": "All Data",
    "dateRange.7d": "7D",
    "dateRange.14d": "14D",
    "dateRange.30d": "30D",
    "dateRange.all": "All",
    
    // Export
    "export.exportData": "Export Data",
    "export.export": "Export",
    "export.exportSessions": "Export Sessions (CSV)",
    "export.exportSummary": "Export Summary (CSV)",
    "export.exportEnergy": "Export Energy Report (CSV)",
    
    // Charts
    "chart.chargeByVehicle": "Charge by Vehicle",
    "chart.totalChargeReceived": "Total charge added per vehicle",
    "chart.chargingPatterns": "Charging Patterns",
    "chart.speedAndTime": "Charging speed (%SoC/min) vs session time (minutes)",
    "chart.dailyTrend": "Daily Charging Trend",
    "chart.chargeOverTime": "Charge added over time by vehicle",
    "chart.cumulativeCharge": "Cumulative Charge",
    "chart.totalChargeAccumulated": "Total charge accumulated over time",
    "chart.chargerEfficiency": "Charger Efficiency",
    "chart.chargerSpeedComparison": "Average charging speed by charger",
    
    // Table
    "table.vehicleData": "Vehicle Summary Statistics",
    "table.detailedBreakdown": "Summary statistics for each vehicle (click headers to sort)",
    "table.vehicle": "Vehicle",
    "table.totalCharge": "Total Charge",
    "table.sessions": "Sessions",
    "table.avgSpeed": "Avg Speed",
    "table.avgTime": "Avg Time",
    "table.charger": "Charger",
    
    // Charger Table
    "chargerTable.title": "Charger Performance",
    "chargerTable.description": "Charging speed and usage by charger",
    
    // Comparison Panel
    "comparison.title": "Period Comparison",
    "comparison.description": "Compare charging metrics between two time periods",
    "comparison.period1": "Period 1",
    "comparison.period2": "Period 2",
    "comparison.selectStartDate": "Select start date",
    "comparison.selectEndDate": "Select end date",
    "comparison.totalCharge": "Total Charge",
    "comparison.sessions": "Sessions",
    "comparison.avgSpeed": "Avg Speed",
    "comparison.change": "Change",
    
    // Insights
    "insights.title": "Key Insights",
    "insights.description": "Key insights from the ITS data analysis",
    
    // Energy Section
    "energy.sectionTitle": "Energy Analysis",
    
    // Footer
    "footer.copyright": "© 2026 ITS Project. All rights reserved.",

    // Login
    "login.title": "Sign In",
    "login.description": "Sign in with your authorized account",
    "login.email": "Email",
    "login.password": "Password",
    "login.submit": "Sign In",
    "login.error": "Login Failed",

    // Auth header
    "header.signOut": "Sign Out",
    "actions.recompute": "Recompute",
    "actions.recomputed": "Recomputed from latest data ({sessions} sessions, {start} – {end})",

    // Password reset
    "reset.forgotLink": "Forgot your password?",
    "reset.forgotTitle": "Reset Password",
    "reset.forgotDescription": "Enter your email to receive a password reset link",
    "reset.sendLink": "Send Reset Link",
    "reset.backToLogin": "Back to Sign In",
    "reset.emailSent": "Email Sent",
    "reset.emailSentDescription": "Check your inbox for a password reset link",
    "reset.newPasswordTitle": "Set New Password",
    "reset.newPasswordDescription": "Choose a strong password for your account",
    "reset.confirmPassword": "Confirm Password",
    "reset.passwordsMismatch": "Passwords do not match",
    "reset.updatePassword": "Update Password",
    "reset.success": "Password updated successfully",
    "reset.criteria.minLength": "At least 8 characters",
    "reset.criteria.uppercase": "One uppercase letter",
    "reset.criteria.lowercase": "One lowercase letter",
    "reset.criteria.number": "One number",
    "reset.criteria.special": "One special character (!@#$...)",

    // Signup
    "signup.title": "Create Account",
    "signup.description": "Sign up for a new account",
    "signup.submit": "Sign Up",
    "signup.switchToSignup": "Don't have an account? Sign up",
    "signup.switchToLogin": "Already have an account? Sign in",
    "signup.success": "Account Created",
    "signup.successDescription": "You can now sign in with your credentials",

    "admin.title": "User Management",
    "admin.usersTitle": "Authorized Users",
    "admin.usersDescription": "Manage users who can access the dashboard",
    "admin.addUser": "Add User",
    "admin.addUserDescription": "Create a new authorized user account",
    "admin.displayName": "Display Name",
    "admin.role": "Role",
    "admin.lastSignIn": "Last Sign In",
    "admin.create": "Create User",
    "admin.userCreated": "User created successfully",
    "admin.userDeleted": "User deleted successfully",
    "admin.confirmDelete": "Delete User",
    "admin.confirmDeleteDescription": "Are you sure you want to delete {email}? This action cannot be undone.",
    "admin.cancel": "Cancel",
    "admin.delete": "Delete",
    "admin.error": "Error",
    "admin.manageUsers": "Users",
    "admin.roleUpdated": "Role updated successfully",
    "admin.nameUpdated": "Display name updated successfully",
    "admin.resetPassword": "Reset Password",
    "admin.resetPasswordDescription": "Set a new password for {email}.",
    "admin.newPassword": "New Password",
    "admin.passwordReset": "Password reset successfully",
    "admin.passwordTooShort": "Password must be at least 8 characters with uppercase, lowercase, number, and special character",
    "forcePassword.title": "Change Your Password",
    "forcePassword.description": "For security reasons, you must set a new password before continuing.",
    "forcePassword.success": "Password updated successfully",
  },
  sv: {
    // Header
    "header.dataAnalysis": "ITS Dataanalys",
    "header.reportDate": "Rapportdatum:",
    "header.author": "Författare:",
    "header.period": "Period:",
    
    // Hero Section
    "hero.draft": "UTKAST - Analysrapport",
    "hero.title": "Analys av ITS Data",
    "hero.description": "Utifrån de {sessions} effektiva laddningssessionerna i datamängden ({zero} noll-laddningsförsök exkluderade) har vi analyserat total tillförd laddning, genomsnittlig laddningshastighet och sessionstid för {vehicles} fordon och {chargers} laddare.",
    "hero.batteryInfo": "TT (terminaltruck) batterikapacitet: 236 kWh",
    "spec.title": "Fordonsspecifikation",
    "spec.subtitle": "Referensvärden som används i alla kWh-beräkningar",
    "spec.batteryCapacity": "TT Batterikapacitet",
    "spec.kwhPerSoc": "Per 1 % SoC",
    "spec.kwhPerSocTooltip": "Härleds från 236 kWh ÷ 100 = 2,36 kWh per 1 % SoC. Denna omräkningsfaktor används i varje laddningssession för att översätta %SoC till kWh.",
    "table.kwhCharged": "kWh Laddad",
    "table.summary.totalSessions": "Totalt Antal Sessioner",
    "table.summary.totalKwh": "Totalt kWh Laddat",
    "table.summary.avgKwh": "Snitt kWh per Session",
    "breakdown.title.vehicle": "kWh Laddat per Fordon",
    "breakdown.title.charger": "kWh Laddat per Laddare",
    "breakdown.subtitle": "Totalt kWh laddat baserat på aktiva filter",
    "breakdown.export": "Exportera kWh Uppdelning (CSV)",
    
    // Metrics
    "metrics.totalCharge": "Total Tillförd Laddning",
    "metrics.totalSessions": "Totalt Antal Sessioner",
    "metrics.avgChargingSpeed": "Snitt Laddningshastighet",
    "metrics.avgSessionTime": "Snitt Sessionstid",
    "metrics.fromVehicles": "Från {count} fordon",
    "metrics.chargingSessions": "Laddningssessioner",
    "metrics.perMinute": "%SoC per minut",
    "metrics.minutes": "{value} min",
    "metrics.totalEnergyReceived": "Total Mottagen Energi",
    "metrics.vehicleSessions": "Från {count} fordonssessioner",
    
    // Data source indicator
    "dataSource.showing": "Visar data för senaste {days} dagarna ({sessions} sessioner). Välj \"All Data\" för komplett rapportdata.",
    
    // Vehicle Selector
    "vehicleSelector.selectVehicles": "Välj Fordon",
    "vehicleSelector.allVehicles": "Alla Fordon",
    
    // Date Range
    "dateRange.7days": "7 Dagar",
    "dateRange.14days": "14 Dagar",
    "dateRange.30days": "30 Dagar",
    "dateRange.allData": "All Data",
    "dateRange.7d": "7D",
    "dateRange.14d": "14D",
    "dateRange.30d": "30D",
    "dateRange.all": "Alla",
    
    // Export
    "export.exportData": "Exportera Data",
    "export.export": "Export",
    "export.exportSessions": "Exportera Sessioner (CSV)",
    "export.exportSummary": "Exportera Sammanfattning (CSV)",
    "export.exportEnergy": "Exportera Energirapport (CSV)",
    
    // Charts
    "chart.chargeByVehicle": "Laddning per Fordon",
    "chart.totalChargeReceived": "Total tillförd laddning per fordon",
    "chart.chargingPatterns": "Laddningsmönster",
    "chart.speedAndTime": "Laddningshastighet (%SoC/min) vs sessionstid (minuter)",
    "chart.dailyTrend": "Daglig Laddningstrend",
    "chart.chargeOverTime": "Tillförd laddning över tid per fordon",
    "chart.cumulativeCharge": "Kumulativ Laddning",
    "chart.totalChargeAccumulated": "Total ackumulerad laddning över tid",
    "chart.chargerEfficiency": "Laddareffektivitet",
    "chart.chargerSpeedComparison": "Genomsnittlig laddningshastighet per laddare",
    
    // Table
    "table.vehicleData": "Sammanfattande Statistik per Fordon",
    "table.detailedBreakdown": "Sammanfattande statistik per fordon (klicka på rubrik för att sortera)",
    "table.vehicle": "Fordon",
    "table.totalCharge": "Total Laddning",
    "table.sessions": "Sessioner",
    "table.avgSpeed": "Snitt Hastighet",
    "table.avgTime": "Snitt Tid",
    "table.charger": "Laddare",
    
    // Charger Table
    "chargerTable.title": "Laddarprestanda",
    "chargerTable.description": "Laddningshastighet och användning per laddare",
    
    // Comparison Panel
    "comparison.title": "Periodjämförelse",
    "comparison.description": "Jämför laddningsmått mellan två tidsperioder",
    "comparison.period1": "Period 1",
    "comparison.period2": "Period 2",
    "comparison.selectStartDate": "Välj startdatum",
    "comparison.selectEndDate": "Välj slutdatum",
    "comparison.totalCharge": "Total Laddning",
    "comparison.sessions": "Sessioner",
    "comparison.avgSpeed": "Snitt Hastighet",
    "comparison.change": "Förändring",
    
    // Insights
    "insights.title": "Viktiga Insikter",
    "insights.description": "Viktiga insikter från ITS dataanalysen",
    
    // Energy Section
    "energy.sectionTitle": "Energianalys",
    
    // Footer
    "footer.copyright": "© 2026 ITS Projekt. Alla rättigheter förbehållna.",

    // Login
    "login.title": "Logga In",
    "login.description": "Logga in med ditt behöriga konto",
    "login.email": "E-post",
    "login.password": "Lösenord",
    "login.submit": "Logga In",
    "login.error": "Inloggning Misslyckades",

    // Auth header
    "header.signOut": "Logga Ut",
    "actions.recompute": "Räkna om",
    "actions.recomputed": "Omräknat från senaste data ({sessions} sessioner, {start} – {end})",

    // Password reset
    "reset.forgotLink": "Glömt ditt lösenord?",
    "reset.forgotTitle": "Återställ Lösenord",
    "reset.forgotDescription": "Ange din e-post för att få en återställningslänk",
    "reset.sendLink": "Skicka Återställningslänk",
    "reset.backToLogin": "Tillbaka till Inloggning",
    "reset.emailSent": "E-post Skickat",
    "reset.emailSentDescription": "Kontrollera din inkorg för en lösenordsåterställningslänk",
    "reset.newPasswordTitle": "Ange Nytt Lösenord",
    "reset.newPasswordDescription": "Välj ett starkt lösenord för ditt konto",
    "reset.confirmPassword": "Bekräfta Lösenord",
    "reset.passwordsMismatch": "Lösenorden matchar inte",
    "reset.updatePassword": "Uppdatera Lösenord",
    "reset.success": "Lösenordet har uppdaterats",
    "reset.criteria.minLength": "Minst 8 tecken",
    "reset.criteria.uppercase": "En stor bokstav",
    "reset.criteria.lowercase": "En liten bokstav",
    "reset.criteria.number": "En siffra",
    "reset.criteria.special": "Ett specialtecken (!@#$...)",

    // Signup
    "signup.title": "Skapa Konto",
    "signup.description": "Registrera ett nytt konto",
    "signup.submit": "Registrera",
    "signup.switchToSignup": "Har du inget konto? Registrera dig",
    "signup.switchToLogin": "Har du redan ett konto? Logga in",
    "signup.success": "Konto Skapat",
    "signup.successDescription": "Du kan nu logga in med dina uppgifter",

    "admin.title": "Användarhantering",
    "admin.usersTitle": "Behöriga Användare",
    "admin.usersDescription": "Hantera användare som kan komma åt instrumentpanelen",
    "admin.addUser": "Lägg till Användare",
    "admin.addUserDescription": "Skapa ett nytt behörigt användarkonto",
    "admin.displayName": "Visningsnamn",
    "admin.role": "Roll",
    "admin.lastSignIn": "Senaste Inloggning",
    "admin.create": "Skapa Användare",
    "admin.userCreated": "Användare skapad",
    "admin.userDeleted": "Användare borttagen",
    "admin.confirmDelete": "Ta bort Användare",
    "admin.confirmDeleteDescription": "Är du säker på att du vill ta bort {email}? Denna åtgärd kan inte ångras.",
    "admin.cancel": "Avbryt",
    "admin.delete": "Ta bort",
    "admin.error": "Fel",
    "admin.manageUsers": "Användare",
    "admin.roleUpdated": "Roll uppdaterad",
    "admin.nameUpdated": "Visningsnamn uppdaterat",
    "admin.resetPassword": "Återställ Lösenord",
    "admin.resetPasswordDescription": "Ange ett nytt lösenord för {email}.",
    "admin.newPassword": "Nytt Lösenord",
    "admin.passwordReset": "Lösenord återställt",
    "admin.passwordTooShort": "Lösenordet måste vara minst 8 tecken med versal, gemen, siffra och specialtecken",
    "forcePassword.title": "Byt ditt lösenord",
    "forcePassword.description": "Av säkerhetsskäl måste du välja ett nytt lösenord innan du fortsätter.",
    "forcePassword.success": "Lösenordet har uppdaterats",
  },
};

const fallbackLanguageContext: LanguageContextType = {
  language: "en",
  setLanguage: () => {},
  t: (key: string) => translations.en[key] || key,
};

const LanguageContext = createContext<LanguageContextType>(fallbackLanguageContext);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("language");
      if (stored === "en" || stored === "sv") {
        return stored;
      }
    }
    return "en";
  });

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    if (typeof window !== "undefined") {
      localStorage.setItem("language", lang);
    }
  }, []);

  const t = useCallback((key: string) => {
    return translations[language][key] || key;
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
