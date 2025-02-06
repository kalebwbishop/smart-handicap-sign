import React, { useState, useEffect } from "react";
import { useRoute } from "@react-navigation/native";

import KWBScreenWrapper from "@/components/KWBScreenWrapper";
import KWBTypography from "@/components/KWBTypography";
import { AddSignPageRouteProp } from "@/types";

import Page1 from "./subpages/Page1";
import Page2 from "./subpages/Page2";
import Page3 from "./subpages/Page3";

// Page 1: Prepare Your IoT Device
// Page 2: Scan the QR Code
// Page 3: Scan the Barcode

export default function AddSignPage() {
    const [headerText, setHeaderText] = useState("Add Sign");

    const route = useRoute<AddSignPageRouteProp>();
    const { page, ssid } = route.params;

    useEffect(() => {
        switch (page) {
            case 1:
                setHeaderText("Prepare Your IoT Device");
                break;
            case 2:
                setHeaderText("Available Networks");
                break;
            case 3:
                setHeaderText(ssid ? `Connect to ${ssid}` : "Connect to Network");
                break;
            default:
                setHeaderText("Add Sign");
        }
    }, [page]);

    const getPage = () => {
        switch (page) {
            case 1:
                return <Page1 />;
            case 2:
                return <Page2 />;
            case 3:
                return <Page3 ssid={ssid} />;
            default:
                return <KWBTypography>Page not found</KWBTypography>;
        }
    };

    return <KWBScreenWrapper headerText={headerText}>{getPage()}</KWBScreenWrapper>;
}
