import React from "react";
import { Text, View } from "react-native";

import KWBScreenWrapper from "@/components/KWBScreenWrapper";
import KWBTypography from "@/components/KWBTypography";

const parking_lots = {
    'Parking Lot A': {
        'Spot A1': {
            'state': 'ready',
        },
        'Spot A2': {
            'state': 'ready',
        },
        'Spot A3': {
            'state': 'ready',
        }
    },
    'Parking Lot B': {
        'Spot B1': {
            'state': 'ready',
        },
        'Spot B2': {
            'state': 'assistance_requested',
        },
        'Spot B3': {
            'state': 'ready',
        }
    }
}

function SignElement({ spot_name }: { spot_name: string }) {
    return (
        <View
            style={{
                flex: 1,
                justifyContent: "center",
                alignItems: "center",
                backgroundColor: "#3A3941",
                paddingVertical: 20,
                marginHorizontal: 8,
                borderRadius: 8,
                borderStyle: "solid",
                borderWidth: 2,
                borderColor: "#FF7500A0",
                marginBottom: 48,
            }}
        >
            <KWBTypography>{spot_name}</KWBTypography>
            <KWBTypography>Notify - Help is on the way!</KWBTypography>
        </View>
    );
}

function SignRow() {
    let assistance_requested_spots = []

    for (const parking_lot in parking_lots) {
        for (const spot in parking_lots[parking_lot]) {
            if (parking_lots[parking_lot][spot]['state'] === 'assistance_requested') {
                assistance_requested_spots.push(spot)
            }
        }
    }

    return (
        <>
            {assistance_requested_spots.map((spot_name) => (
                <View
                    style={{
                        flexDirection: "row",
                        flex: 1,
                        marginHorizontal: -8,
                    }}
                >
                    <SignElement spot_name={spot_name} />
                </View>
            ))};
        </>
    );
}

function ParkingLot() {
    return (
        <>
            {Object.keys(parking_lots).map((parking_lot_key) => (
                <View
                    style={{
                        flex: 1,
                        justifyContent: "center",
                        alignItems: "center",
                        backgroundColor: "#3A3941",
                        padding: 20,
                        marginHorizontal: 8,
                        borderRadius: 8,
                        borderStyle: "solid",
                        borderWidth: 2,
                        borderColor: "#FF7500A0",
                        marginBottom: 16,
                    }}
                >
                    <KWBTypography>{parking_lot_key}</KWBTypography>
                </View>
            ))}
        </>
    );
}

export default function MainPage() {
    return (
        <KWBScreenWrapper headerText="HH" backButtonActive={false}>
            <KWBTypography variant="h3">Needs Attention</KWBTypography>
            <SignRow />

            {/* Parking Lots */}
            <KWBTypography variant="h3">Parking Lots</KWBTypography>
            <ParkingLot />
        </KWBScreenWrapper>
    );
}