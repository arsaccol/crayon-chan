import fetch from 'node-fetch';

export async function getWeather(input: {city: string}): Promise<string> {
    console.log("======================== 🌧️ CHECKING THE WEATHER ☀️ ===================")
    const { city } = input

    console.log(`🌆 Input city: ${city}`)
    try {
        const url = `https://wttr.in/${encodeURIComponent(city)}?format=j1`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.current_condition && data.current_condition.length > 0) {
            // Sort conditions by observation time, newest first
            data.current_condition.sort((a: any, b: any) => {
                return new Date(b.observation_time).getTime() - new Date(a.observation_time).getTime();
            });

            const currentWeather = data.current_condition[0];

            console.log({currentWeather})
            const temperature = currentWeather.temp_C;
            const feelsLike = currentWeather.FeelsLikeC;
            const description = currentWeather.weatherDesc[0].value;
            const humidity = currentWeather.humidity;
            const windspeed = currentWeather.windspeedKmph;

            return `The current weather in ${JSON.stringify(city, null, 2)} is ${description} with a temperature of ${temperature}°C (feels like ${feelsLike}°C). Humidity is ${humidity}%, Wind Speed is ${windspeed} Kmph.`;
        } else {
            return `Could not retrieve weather information for ${city}.`;
        }
    } catch (error) {
        console.error("Error fetching weather:", error);
        return `Failed to retrieve weather information for ${city}.`;
    }
}
