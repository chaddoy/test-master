### Test Master

Prerequisite:
MongoDB
- install mongodb
- (start mongodb ) mongo & ( to start daemon mongodb )

Installing MASTER:
-  export MONGO address
- ( in terminal) export MONGO=mongodb://localhost/e2e ( if mongodb and master is on the same machine otherwise change localhost to where your mongodb is located )
- or add `export MONGO=mongodb://localhost/e2e` in your bash profile
- Clone this repository `git clone git@github.com:yamii/test-master.git`
- Install npm `npm install`
- Type ```chmod +x prerequisite.sh```
- Run ```./prerequisite.sh```
- Type ```chmod +x run-master.sh```
- Run ```./run-master.sh```
