// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title EmpireChainGame
/// @notice Core on-chain loop for a browser strategy game inspired by classic mechanics,
///         but with original branding/data structures to avoid IP infringement.
contract EmpireChainGame {
    uint256 public constant BASE_STORAGE_CAP = 50_000;
    uint256 public constant RESOURCE_RATE_PER_HOUR = 120;
    uint256 public constant TRAINING_TIME = 5 minutes;

    struct Village {
        bool created;
        uint256 wood;
        uint256 clay;
        uint256 iron;
        uint256 crop;
        uint256 lastClaim;
        uint256 warriors;
        uint256 defenders;
    }

    struct TrainingOrder {
        uint256 warriorAmount;
        uint256 defenderAmount;
        uint256 readyAt;
    }

    mapping(address => Village) public villages;
    mapping(address => TrainingOrder) public queuedTraining;

    event VillageCreated(address indexed player);
    event ResourcesClaimed(address indexed player, uint256 producedPerResource);
    event TroopsQueued(address indexed player, uint256 warriorAmount, uint256 defenderAmount, uint256 readyAt);
    event TroopsMinted(address indexed player, uint256 warriors, uint256 defenders);
    event AttackResolved(address indexed attacker, address indexed defender, bool attackerWon, uint256 plunderedPerResource);

    error VillageAlreadyExists();
    error VillageNotFound();
    error InvalidAmount();
    error AlreadyTraining();
    error TrainingNotReady();
    error CannotAttackSelf();
    error NotEnoughTroops();
    error InsufficientResources();

    modifier hasVillage(address player) {
        if (!villages[player].created) revert VillageNotFound();
        _;
    }

    function createVillage() external {
        if (villages[msg.sender].created) revert VillageAlreadyExists();

        villages[msg.sender] = Village({
            created: true,
            wood: 5_000,
            clay: 5_000,
            iron: 5_000,
            crop: 5_000,
            lastClaim: block.timestamp,
            warriors: 20,
            defenders: 20
        });

        emit VillageCreated(msg.sender);
    }

    function claimResources() public hasVillage(msg.sender) {
        Village storage v = villages[msg.sender];
        uint256 elapsed = block.timestamp - v.lastClaim;
        if (elapsed == 0) return;

        uint256 producedPerResource = (elapsed * RESOURCE_RATE_PER_HOUR) / 3600;
        if (producedPerResource > 0) {
            v.wood = _cap(v.wood + producedPerResource);
            v.clay = _cap(v.clay + producedPerResource);
            v.iron = _cap(v.iron + producedPerResource);
            v.crop = _cap(v.crop + producedPerResource);
            emit ResourcesClaimed(msg.sender, producedPerResource);
        }

        v.lastClaim = block.timestamp;
    }

    function queueTraining(uint256 warriorAmount, uint256 defenderAmount) external hasVillage(msg.sender) {
        if (warriorAmount == 0 && defenderAmount == 0) revert InvalidAmount();

        TrainingOrder storage order = queuedTraining[msg.sender];
        if (order.readyAt != 0) revert AlreadyTraining();

        claimResources();

        uint256 woodCost = warriorAmount * 60 + defenderAmount * 50;
        uint256 clayCost = warriorAmount * 40 + defenderAmount * 60;
        uint256 ironCost = warriorAmount * 50 + defenderAmount * 60;
        uint256 cropCost = warriorAmount * 30 + defenderAmount * 20;

        Village storage v = villages[msg.sender];
        if (v.wood < woodCost || v.clay < clayCost || v.iron < ironCost || v.crop < cropCost) {
            revert InsufficientResources();
        }

        v.wood -= woodCost;
        v.clay -= clayCost;
        v.iron -= ironCost;
        v.crop -= cropCost;

        uint256 readyAt = block.timestamp + TRAINING_TIME;
        queuedTraining[msg.sender] = TrainingOrder(warriorAmount, defenderAmount, readyAt);

        emit TroopsQueued(msg.sender, warriorAmount, defenderAmount, readyAt);
    }

    function finalizeTraining() external hasVillage(msg.sender) {
        TrainingOrder memory order = queuedTraining[msg.sender];
        if (order.readyAt == 0 || block.timestamp < order.readyAt) revert TrainingNotReady();

        delete queuedTraining[msg.sender];

        Village storage v = villages[msg.sender];
        v.warriors += order.warriorAmount;
        v.defenders += order.defenderAmount;

        emit TroopsMinted(msg.sender, order.warriorAmount, order.defenderAmount);
    }

    function attack(address defender, uint256 warriorsSent, uint256 defendersSent)
        external
        hasVillage(msg.sender)
        hasVillage(defender)
    {
        if (defender == msg.sender) revert CannotAttackSelf();
        if (warriorsSent == 0 && defendersSent == 0) revert InvalidAmount();

        Village storage atk = villages[msg.sender];
        Village storage def = villages[defender];

        if (atk.warriors < warriorsSent || atk.defenders < defendersSent) revert NotEnoughTroops();

        atk.warriors -= warriorsSent;
        atk.defenders -= defendersSent;

        uint256 attackPower = warriorsSent * 110 + defendersSent * 90;
        uint256 defensePower = def.warriors * 90 + def.defenders * 120;

        bool attackerWon = attackPower > defensePower;
        uint256 plundered = 0;

        if (attackerWon) {
            plundered = _min4(def.wood, def.clay, def.iron, def.crop) / 10;

            def.wood -= plundered;
            def.clay -= plundered;
            def.iron -= plundered;
            def.crop -= plundered;

            atk.wood = _cap(atk.wood + plundered);
            atk.clay = _cap(atk.clay + plundered);
            atk.iron = _cap(atk.iron + plundered);
            atk.crop = _cap(atk.crop + plundered);

            atk.warriors += (warriorsSent * 70) / 100;
            atk.defenders += (defendersSent * 70) / 100;

            def.warriors = (def.warriors * 50) / 100;
            def.defenders = (def.defenders * 50) / 100;
        } else {
            def.warriors = (def.warriors * 90) / 100;
            def.defenders = (def.defenders * 90) / 100;
        }

        emit AttackResolved(msg.sender, defender, attackerWon, plundered);
    }

    function trainingReadyAt(address player) external view returns (uint256) {
        return queuedTraining[player].readyAt;
    }

    function _cap(uint256 value) internal pure returns (uint256) {
        return value > BASE_STORAGE_CAP ? BASE_STORAGE_CAP : value;
    }

    function _min4(uint256 a, uint256 b, uint256 c, uint256 d) internal pure returns (uint256) {
        uint256 m = a < b ? a : b;
        m = m < c ? m : c;
        return m < d ? m : d;
    }
}
