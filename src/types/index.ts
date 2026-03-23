export interface EventConfig {
    id: string;
    eventName: string;
    eventDescription: string;
    activeCategories: string[];
    registration_close_date: string;
}

export interface Participant {
    id?: string;
    event_id: string;
    documentnumber: string;
    licensenumber?: string;
    dob: string;
    fullname: string;
    category: string;
    club?: string;
    sponsor?: string;
    gender: 'M' | 'F';
    email: string;
    mobile: string;
    registration_date?: string;
}
