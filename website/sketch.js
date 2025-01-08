class ParkingLot {
    constructor(w, h) {
      this.parkingSpots = [];
      this.intersections = [];
  
      const wSpacing = 20;
      const hSpacing = 2 * wSpacing;
      const blockCount = 10;
  
      for (let j = 1; j <= h / hSpacing; j += 3) {
        let intersectionRow = [];
        for (let i = 0; i < w / wSpacing; i++) {
          const x = i * wSpacing;
          const y = j * hSpacing;
  
          if (i % blockCount === 0) {
            i++;
            intersectionRow.push([x + wSpacing, y - 0.5 * hSpacing]);
          } else if (j < h / hSpacing) {
            // [x, y, go to y]
            this.parkingSpots.push([
              x + 0.5 * wSpacing,
              y + 0.5 * hSpacing,
              y - 0.5 * hSpacing,
            ]);
            this.parkingSpots.push([
              x + 0.5 * wSpacing,
              y + 1.5 * hSpacing,
              y + 2.5 * hSpacing,
            ]);
          }
        }
        this.intersections.push(intersectionRow);
      }
    }
  
    draw() {
      const wSpacing = 20;
      const hSpacing = 2 * wSpacing;
      const blockCount = 10;
  
      push();
      fill("red");
  
      this.intersections.forEach((intersectionRow) => {
        intersectionRow.forEach((intersection) => {
          circle(intersection[0], intersection[1], 10);
        });
      });
      pop();
  
      push();
      strokeWeight(2);
      stroke(255);
  
      for (let j = 1; j < height / hSpacing; j += 3) {
        for (let i = 0; i < width / wSpacing; i++) {
          const x = i * wSpacing;
          const y = j * hSpacing;
          line(x, y, x, y + 2 * hSpacing);
  
          if (i % blockCount === 0) {
            i++;
          } else {
            line(x, y + hSpacing, x + wSpacing, y + hSpacing);
            fill("green");
            circle(x + 0.5 * wSpacing, y + 0.5 * hSpacing, 10);
            circle(x + 0.5 * wSpacing, y + 1.5 * hSpacing, 10);
          }
        }
      }
      pop();
    }
  }
  
  class Vehicle {
    constructor(x, y, parkingLot) {
      this.x = x;
      this.y = y;
  
      this.parkingLot = parkingLot;
  
      this.spotIndex = floor(random(this.parkingLot.parkingSpots.length));
  
      this.path = [];
    }
  
    init_path() {
      this.spotIndex = floor(random(this.parkingLot.parkingSpots.length));
  
      this.path = [
        [
          this.parkingLot.parkingSpots[this.spotIndex][0],
          this.parkingLot.parkingSpots[this.spotIndex][1],
        ],
      ];
  
      this.path.push([
        this.parkingLot.parkingSpots[this.spotIndex][0],
        this.parkingLot.parkingSpots[this.spotIndex][2],
      ]);
      
      const wSpacing = 20;
      const hSpacing = 2 * wSpacing;
      const blockCount = 10;
  
      let y =
        (this.parkingLot.parkingSpots[this.spotIndex][2] - 0.5 * hSpacing) /
        (3 * hSpacing);
      let x = floor(
        this.parkingLot.parkingSpots[this.spotIndex][0] / (blockCount * wSpacing)
      );
  
      let h1 = this.parkingLot.intersections[y][x];
      let h2 = this.parkingLot.intersections[y][x + 1];
  
      const distance = (coord1, coord2) => {
        return pow(coord1[0] - coord2[0], 2) + pow(coord1[1] - coord2[1], 2);
      };
      
      const vehicle_distance = distance([this.x, this.y], this.path[0])
      
      
      let closestCoord
      
      if (typeof h1 === 'undefined') {
        closestCoord = h2
      }
      else if (typeof h2 === 'undefined') {
        closestCoord = h1
      }
      else {
        const d1 = distance(h1, [
          this.parkingLot.parkingSpots[this.spotIndex][0],
          this.parkingLot.parkingSpots[this.spotIndex][2]
        ])
        const d2 = distance(h2, [
          this.parkingLot.parkingSpots[this.spotIndex][0],
          this.parkingLot.parkingSpots[this.spotIndex][2]
        ])
        
        const r1 = distance(h1, [this.x, this.y])
        const r2 = distance(h2, [this.x, this.y])
        
        if (d1 + r1 > d2 + r2) {
          closestCoord = h2
        }
        else {
          closestCoord = h1
        }
      }
      
      this.path.push(closestCoord)
      
      
      
      
    }
  
    move() {
      const speed = 5;
  
      if (this.path.length === 0) {
        this.init_path();
        return;
      }
  
      const xDir = this.x - this.path[this.path.length - 1][0];
      const yDir = this.y - this.path[this.path.length - 1][1];
  
      const distance = sqrt(pow(xDir, 2) + pow(yDir, 2));
  
      if (distance <= speed) {
        this.path.pop();
      } else {
        this.x -= (speed * xDir) / distance;
        this.y -= (speed * yDir) / distance;
      }
    }
  
    draw() {
      this.move();
  
      push();
      fill("red");
  
      circle(
        parkingLot.parkingSpots[this.spotIndex][0],
        parkingLot.parkingSpots[this.spotIndex][1],
        13
      );
  
      fill("yellow");
  
      circle(
        parkingLot.parkingSpots[this.spotIndex][0],
        parkingLot.parkingSpots[this.spotIndex][2],
        13
      );
  
      pop();
  
      line(
        parkingLot.parkingSpots[this.spotIndex][0],
        parkingLot.parkingSpots[this.spotIndex][1],
        parkingLot.parkingSpots[this.spotIndex][0],
        parkingLot.parkingSpots[this.spotIndex][2]
      );
  
      line(
        this.x,
        this.y,
        parkingLot.parkingSpots[this.spotIndex][0],
        parkingLot.parkingSpots[this.spotIndex][2]
      );
  
      circle(this.x, this.y, 10);
    }
  }
  
  let parkingLot;
  let vehicles = [];
  
  function setup() {
    createCanvas(windowWidth, 400);
  
    parkingLot = new ParkingLot(width, height);
  
    for (let i = 0; i < 1; i++) {
      vehicles.push(new Vehicle(random(width), random(400), parkingLot));
    }
  }
  
  function draw() {
    background(120);
  
    parkingLot.draw();
  
    vehicles.forEach((vehicle) => {
      vehicle.draw();
    });
  }
  