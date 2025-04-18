export interface MessageHistory {
    role: string;
    parts: {
        text: string;
    }[];
}

