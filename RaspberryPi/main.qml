import QtQuick 2.15
import QtQuick.Controls 2.15
import QtQuick.Window 2.1

Window {
    visibility: Window.FullScreen
    title: "Hazard Hero"
    property string currTime: "00:00:00"
    property QtObject backend

    FontLoader {
        id: avantGardeFont
        source: "fonts/itc-avant-garde-std-bold.ttf"
    }

    property string assistanceText: "Hazard Hero Demo v1"
    property string subtext: "Turn on your hazard lights and help will be on the way."
    property int textIndex: 0

Rectangle {
    anchors.fill: parent
    id: mainBackground

    Image {
        sourceSize.width: parent.width
        sourceSize.height: parent.height
        source: "./images/KrogerBackground.png"
        fillMode: Image.PreserveAspectCrop
    }

    Rectangle {
        anchors.fill: parent
        color: "transparent"

        // Rectangle for Text Background
        Rectangle {
            id: textBackground
            color: "#95ffffff"
            radius: 20  
            width: 1500
            height: 250
            anchors.horizontalCenter: parent.horizontalCenter
            anchors.verticalCenter: parent.verticalCenter
            anchors.verticalCenterOffset: 118


            // Main Text
            Text {
                id: assistanceTextElement
                text: assistanceText
                font.pixelSize: 75
                color: "black"
                font.family: avantGardeFont.name
                anchors.horizontalCenter: textBackground.horizontalCenter
                anchors.verticalCenterOffset: -40  
            }
            Text {
                id: waitTextElement
                text: "please Wait. Help is on the way."
                visible: false
                font.pixelSize: 45
                color: "black"
                font.family: avantGardeFont.name
                anchors.horizontalCenter: textBackground.horizontalCenter
                anchors.verticalCenterOffset: -40  
            }

            // Subtext 
            Text {
                id: subtextElement
                text: subtext
                font.pixelSize: 25
                color: "black"
                font.family: avantGardeFont.name
                opacity: 0
                anchors.horizontalCenter: textBackground.horizontalCenter
                anchors.top: assistanceTextElement.bottom
                anchors.topMargin: 10
            }
            Text {
                id: waitsubtextElement
                text: "Por favor, espere. La ayuda está en camino."
                visible: false
                font.pixelSize: 35
                color: "black"
                font.family: avantGardeFont.name
                anchors.horizontalCenter: textBackground.horizontalCenter
                anchors.top: assistanceTextElement.bottom
                anchors.topMargin: 10
            }
        }

        // Current Time
        Text {
            anchors {
                bottom: parent.bottom
                bottomMargin: 12
                left: parent.left
                leftMargin: 12
            }
            text: currTime
            font.pixelSize: 20
            color: "black"
            font.family: avantGardeFont.name
        }

        // Hazard Button
        Button {
            id: hazardButton
            anchors {
                horizontalCenter: parent.horizontalCenter
                top: parent.top
                topMargin: 40
            }
            width: 150
            height: 150
            background: Rectangle {
                color: "transparent"
                Image {
                    source: "./images/HazardButton.png"
                    fillMode: Image.PreserveAspectFit
                    anchors.fill: parent
                }
            }

            onClicked: {
                console.log("Hazard button pressed!");
                pressImage.visible = !pressImage.visible;
                // toggle text visibility
                assistanceTextElement.visible = !assistanceTextElement.visible;
                subtextElement.visible = !subtextElement.visible;
                waitTextElement.visible = !waitTextElement.visible;
                waitsubtextElement.visible = !waitsubtextElement.visible;
            
                }   
                
        Image {
            id: pressImage
            source: "./images/Press.png"
            anchors {
                top: hazardButton.top
                topMargin: 147
                left: hazardButton.left
                leftMargin: 5
            }
            width: 100
            height: 100
        }
        }
    }
}


    Timer {
        id: languageSwitchTimer
        interval: 6200  
        repeat: true
        running: true
        onTriggered: {
            if (textIndex === 0) {
                assistanceText = "¿Necesita ayuda?"  
                subtext = "Encienda sus luces de emergencia y la ayuda llegará."
                textIndex = 1
            } else {
                assistanceText = "Need assistance?"  
                subtext = "Turn on your hazard lights and help will be on the way."
                textIndex = 0
            }
            // Start fade animation
            fadeInOutAnimation.restart();
        }
    }

    SequentialAnimation {
        id: fadeInOutAnimation
        running: false  
        loops: 1

        onRunningChanged: {
            if (running) {
                assistanceTextElement.opacity = 0;
                subtextElement.opacity = 0;
            }
        }

        PropertyAnimation { target: assistanceTextElement; property: "opacity"; to: 1; duration: 800 }  // Fade in assistance text
        PropertyAnimation { target: subtextElement; property: "opacity"; to: 1; duration: 800 }  // Fade in subtext
        PauseAnimation { duration: 3000 }  // Hold the text for 3 seconds
        PropertyAnimation { target: assistanceTextElement; property: "opacity"; to: 0; duration: 800 }  // Fade out assistance text
        PropertyAnimation { target: subtextElement; property: "opacity"; to: 0; duration: 800 }  // Fade out subtext
    }

    Connections {
        target: backend

        function onToggle(){
            console.log("Hazard button pressed!");
            pressImage.visible = !pressImage.visible;
            // toggle text visibility
            assistanceTextElement.visible = !assistanceTextElement.visible;
            subtextElement.visible = !subtextElement.visible;
            waitTextElement.visible = !waitTextElement.visible;
            waitsubtextElement.visible = !waitsubtextElement.visible;
        }

        function onUpdated(msg) {
            currTime = msg;
        }
    }
}