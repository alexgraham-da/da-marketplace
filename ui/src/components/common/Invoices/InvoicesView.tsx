import React, { ChangeEvent, useEffect, useMemo, useState } from "react";
import BasePage, { IBasePageProps } from "../../BasePage/BasePage";

import "./InvoicesView.css";
import Add from "../../../assets/Add.svg";
import ArrowDropDown from "../../../assets/ArrowDropDown.svg";
import FilterList from "../../../assets/FilterList.svg";
import { useLedger, useStreamFetchByKeys, useStreamQueries } from "@daml/react";

import InvoiceCard, { InvoiceStatusEnum } from "./InvoiceCard";
import { createPortal } from "react-dom";
import { ContractId } from "@daml/types";
import { InputField } from "../InputField/InputField";
import {
  Auction,
  Invoice,
  InvoiceStatus,
} from "@daml.js/da-marketplace/lib/Factoring/Invoice";
import { Seller } from "@daml.js/da-marketplace/lib/Factoring/Seller";
import { decimalToPercentString } from "../utils";

const InvoicesView: React.FC<IBasePageProps> = (props: IBasePageProps) => {
  const [newInvoiceFormState, setNewInvoiceFormState] = useState({
    dueDate: "",
    issueDate: "",
    invoiceAmount: "",
    payerName: "",
    invoiceNumber: "",
  });
  const [sendToAuctionFormState, setSendToAuctionFormState] = useState({
    minimumQuantity: "0",
    bidIncrement: "0",
    endDate: "",
    contractId: undefined,
    invoice: undefined,
  });
  const [currentSortOption, setCurrentSortOption] = useState<any>();
  const [currentSortFunction, setCurrentSortFunction] = useState<any>();
  const [currentFilters, setCurrentFilters] = useState([
    InvoiceStatusEnum.Live,
    InvoiceStatusEnum.Open,
    InvoiceStatusEnum.Paid,
    InvoiceStatusEnum.Sold,
  ]);
  const [
    sendToAuctionFormMinimumPrice,
    setSendToAuctionFormMinimumPrice,
  ] = useState("0");
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [auctionModalOpen, setAuctionModalOpen] = useState(false);

  const ledger = useLedger();

  const mapInvoiceStatusEnum = (damlStatus: InvoiceStatus) => {
    switch (damlStatus.tag) {
      case "InvoiceLive":
        return InvoiceStatusEnum.Live;
      case "InvoiceOpen":
        return InvoiceStatusEnum.Open;
      case "InvoicePaid":
        return InvoiceStatusEnum.Paid;
      case "InvoiceSold":
        return InvoiceStatusEnum.Sold;
    }
  };

  //#region  DAML stuff
  const invoiceContracts = useStreamQueries(
    Invoice,
    () => [],
    [],
    (e) => {
      console.log("Unexpected close from Invoice: ", e);
    }
  ).contracts;

  const invoiceTokens = useMemo(() => {
    return invoiceContracts.map(
      (invoiceContract) => invoiceContract.payload.token
    );
  }, [invoiceContracts]);

  const auctionContracts = useStreamFetchByKeys(
    Auction,
    () => [...invoiceTokens],
    [invoiceTokens]
  ).contracts;

  const sellerContract = useStreamQueries(
    Seller,
    () => [],
    [],
    (e) => {
      console.log("Unexpected close from Invoice: ", e);
    }
  ).contracts[0];

  const createInvoice = async (
    payer,
    invoiceNumber,
    amount,
    issueDate,
    dueDate
  ) => {
    try {
      await ledger.exercise(
        Seller.Seller_AddInvoice,
        sellerContract.contractId,
        {
          payer,
          invoiceNumber,
          amount,
          issueDate,
          dueDate,
        }
      );
    } catch (e) {
      console.log("Error while adding invoice.");
    }
  };

  const sendToAuction = async (
    contractId: ContractId<Invoice>,
    minimumQuantity,
    minimumProceeds,
    bidIncrement,
    endDate
  ) => {
    try {
      await ledger.exercise(Invoice.Invoice_SendToAuction, contractId, {
        minimumQuantity,
        minimumProceeds,
        bidIncrement,
        endDate: new Date(endDate).toISOString(),
      });
    } catch (e) {
      console.log("Error while sending invoice to auction.");
      console.error(e);
    }
  };
  //#endregion

  const invoices = useMemo(() => {
    const currentFilterFunction = (invoice) =>
      currentFilters.includes(mapInvoiceStatusEnum(invoice.status));
    const currentMapFunction = (invoiceContract: {
      payload: Invoice;
      contractId: ContractId<Invoice>;
    }) => {
      const auctionContract = auctionContracts.find(
        (auction) => auction?.key.label === invoiceContract.payload.token.label
      );

      return {
        ...invoiceContract.payload,
        auction: auctionContract?.payload,
        contractId: invoiceContract.contractId,
      };
    };

    if (currentSortFunction === undefined) {
      return invoiceContracts
        .map(currentMapFunction)
        .filter(currentFilterFunction);
    } else {
      return invoiceContracts
        .map(currentMapFunction)
        .filter(currentFilterFunction)
        .sort(currentSortFunction);
    }
  }, [currentSortFunction, currentFilters, invoiceContracts, auctionContracts]);

  const onSendToAuction = async (contractId) => {
    const invoice = invoices.find(
      (inv) => inv.contractId === contractId
    )[0] as Invoice;
    openAuctionModal();
    setSendToAuctionFormState({
      ...sendToAuctionFormState,
      contractId: contractId,
      invoice: invoice,
    });
  };

  const sendToAuctionSubmit = async () => {
    const minimumProceeds = (
      +sendToAuctionFormState.minimumQuantity * +sendToAuctionFormMinimumPrice
    ).toFixed(0);
    await sendToAuction(
      sendToAuctionFormState.contractId,
      sendToAuctionFormState.minimumQuantity,
      minimumProceeds,
      sendToAuctionFormState.bidIncrement,
      sendToAuctionFormState.endDate
    );
    setAuctionModalOpen(false);
  };

  const createInvoiceSubmit = async () => {
    await createInvoice(
      newInvoiceFormState.payerName,
      newInvoiceFormState.invoiceNumber,
      newInvoiceFormState.invoiceAmount,
      newInvoiceFormState.issueDate,
      newInvoiceFormState.dueDate
    );
    setInvoiceModalOpen(false);
  };

  const openFilterMenu = (event) => {
    switch (event.type) {
      case "blur": {
        //setSortMenuOpen(false);
        break;
      }
      case "click": {
        setFilterMenuOpen(!filterMenuOpen);
        break;
      }
    }
  };

  const filterMenuStatus = () =>
    filterMenuOpen ? "filter-menu-open" : "filter-menu-closed";
  const sortMenuStatus = () =>
    sortMenuOpen ? "sort-menu-open" : "sort-menu-closed";
  const openSortMenu = (event) => {
    switch (event.type) {
      case "blur": {
        //setSortMenuOpen(false);
        break;
      }
      case "click": {
        setSortMenuOpen(!sortMenuOpen);
        break;
      }
    }
  };

  const openInvoiceModal = () => {
    setInvoiceModalOpen(true);
  };
  const openAuctionModal = () => {
    setAuctionModalOpen(true);
  };

  const handleSortMenuFormChange = (e: ChangeEvent) => {
    const value = (e.target as HTMLInputElement).value;
    setCurrentSortOption(value);
    switch (value) {
      case "invoiceAmount-highToLow": {
        setCurrentSortFunction(() => (a: Invoice, b: Invoice) =>
          Number(b?.amount) - Number(a?.amount)
        );
        break;
      }
      case "invoiceAmount-lowToHigh": {
        setCurrentSortFunction(() => (a: Invoice, b: Invoice) =>
          Number(a?.amount) - Number(b?.amount)
        );
        break;
      }
      case "dueDate-newest": {
        setCurrentSortFunction(() => (a: Invoice, b: Invoice) =>
          +new Date(a?.dueDate) - +new Date(b?.dueDate)
        );
        break;
      }
      case "dueDate-oldest": {
        setCurrentSortFunction(() => (a: Invoice, b: Invoice) =>
          +new Date(b?.dueDate) - +new Date(a?.dueDate)
        );
        break;
      }
      case "payerName-alphabetical": {
        setCurrentSortFunction(() => (a: Invoice, b: Invoice) =>
          a?.payer.localeCompare(b?.payer)
        );
        break;
      }
      case "payerName-reverse": {
        setCurrentSortFunction(() => (a: Invoice, b: Invoice) =>
          b?.payer.localeCompare(a?.payer)
        );
        break;
      }
    }
    setSortMenuOpen(false);
  };
  const handleFilterMenuChange = (e: ChangeEvent) => {
    const target = e.target as HTMLInputElement;
    const value = target.value as InvoiceStatusEnum;
    if (target.checked) {
      if (!currentFilters.includes(value)) {
        setCurrentFilters([...currentFilters, value]);
      }
    } else {
      if (currentFilters.includes(value)) {
        setCurrentFilters(currentFilters.filter((status) => status !== value));
      }
    }
  };
  const handleNewInvoiceFormChange = (e: ChangeEvent) => {
    setNewInvoiceFormState({
      ...newInvoiceFormState,
      [(e.target as HTMLInputElement).name]: (e.target as HTMLInputElement)
        .value,
    });
  };
  const handleSendToAuctionFormDiscountChange = (e: ChangeEvent) => {
    const target = e.target as HTMLInputElement;
    console.log("discount");
    setSendToAuctionFormMinimumPrice((1.0 - +target.value * 0.01).toFixed(2));
  };
  const handleSendToAuctionFormMinimumQuantityChange = (e: ChangeEvent) => {
    const target = e.target as HTMLInputElement;
    console.log("proceeds");
    setSendToAuctionFormMinimumPrice(
      (+target.value / +sendToAuctionFormState.minimumQuantity).toFixed(2)
    );
  };

  const handleSendToAuctionFormChange = (e: ChangeEvent) => {
    const target = e.target as HTMLInputElement;
    const name = target.name;
    console.log("other");
    setSendToAuctionFormState({
      ...sendToAuctionFormState,
      [name]: target.value,
    });
  };

  //#region

  const invoicesList = invoices.map((invoice) => {
    const invoiceStatus = mapInvoiceStatusEnum(invoice.status);
    const soldProps =
      invoiceStatus === InvoiceStatusEnum.Sold
        ? {
            auctionSoldDate: (invoice.status.value as InvoiceStatus.InvoiceSold)
              .soldAt,
          }
        : {};
    const latestBid = invoice.auction?.bids.sort(
      (a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)
    )[0];
    return (
      <InvoiceCard
        key={invoice.invoiceNumber}
        payerName={invoice.payer}
        invoiceNumber={invoice.invoiceNumber}
        invoiceAmount={invoice.amount}
        issuedDate={invoice.issueDate}
        paymentDueDate={invoice.dueDate}
        discountRate={decimalToPercentString(latestBid?.price)}
        invoiceStatus={invoiceStatus}
        latestBidAmount={(+latestBid?.amount * +latestBid?.price).toFixed(0)}
        auctionEndDate={invoice.auction?.endDate}
        latestDiscountRate={decimalToPercentString(latestBid?.price)}
        contractId={invoice.contractId}
        onSendToAuction={onSendToAuction}
        {...soldProps}
      />
    );
  });

  const filterMenuArea = (
    <div className="filter-menu-area">
      <button className="filter-menu-button" onClick={openFilterMenu}>
        <img alt="" src={FilterList}></img>
      </button>
      <div className={`filter-menu ${filterMenuStatus()}`}>
        <div className="filter-menu-option">
          <input
            type="checkbox"
            value="Open"
            name="Open"
            id="filter-Open"
            onChange={handleFilterMenuChange}
            checked={currentFilters.includes(InvoiceStatusEnum.Open)}
          />
          <label htmlFor="filter-Open">Open</label>
        </div>
        <div className="filter-menu-option">
          <input
            type="checkbox"
            value="Live"
            name="Live"
            id="filter-Live"
            onChange={handleFilterMenuChange}
            checked={currentFilters.includes(InvoiceStatusEnum.Live)}
          />
          <label htmlFor="filter-Live">Live</label>
        </div>
        <div className="filter-menu-option">
          <input
            type="checkbox"
            value="Sold"
            name="Sold"
            id="filter-Sold"
            onChange={handleFilterMenuChange}
            checked={currentFilters.includes(InvoiceStatusEnum.Sold)}
          />
          <label htmlFor="Sold">Sold</label>
        </div>
        <div className="filter-menu-option">
          <input
            type="checkbox"
            value="Paid"
            name="Paid"
            id="filter-Paid"
            onChange={handleFilterMenuChange}
            checked={currentFilters.includes(InvoiceStatusEnum.Paid)}
          />
          <label htmlFor="filter-Paid">Paid</label>
        </div>
      </div>
    </div>
  );

  const sortMenuArea = (
    <div className="sort-menu-area">
      <button
        className={`sort-menu-button ${sortMenuStatus()}`}
        onClick={openSortMenu}
        onBlur={openSortMenu}
      >
        <div className="sort-menu-button-label">Sort By</div>
        <img
          className="sort-menu-button-arrow"
          alt=""
          src={ArrowDropDown}
        ></img>
      </button>
      <div className={`sort-menu ${sortMenuStatus()}`}>
        <div className="sort-menu-section">
          <div className="sort-menu-section-label">Invoice Amount</div>
          <div>
            <input
              type="radio"
              value="invoiceAmount-highToLow"
              id="invoiceAmount-highToLow"
              checked={currentSortOption === "invoiceAmount-highToLow"}
              onChange={handleSortMenuFormChange}
              name="invoiceSort"
            />
            <label htmlFor="invoiceAmount-highToLow">High to Low</label>
          </div>
          <div>
            <input
              type="radio"
              value="invoiceAmount-lowToHigh"
              checked={currentSortOption === "invoiceAmount-lowToHigh"}
              onChange={handleSortMenuFormChange}
              id="invoiceAmount-lowToHigh"
              name="invoiceSort"
            />
            <label htmlFor="invoiceAmount-lowToHigh">Low to High</label>
          </div>
        </div>
        <div className="sort-menu-section">
          <div className="sort-menu-section-label">Payment Due Date</div>
          <div>
            <input
              type="radio"
              value="dueDate-newest"
              checked={currentSortOption === "dueDate-newest"}
              onChange={handleSortMenuFormChange}
              id="dueDate-newest"
              name="invoiceSort"
            />
            <label htmlFor="dueDate-newest">Newest</label>
          </div>
          <div>
            <input
              type="radio"
              value="dueDate-oldest"
              checked={currentSortOption === "dueDate-oldest"}
              onChange={handleSortMenuFormChange}
              id="dueDate-oldest"
              name="invoiceSort"
            />
            <label htmlFor="dueDate-oldest">Oldest</label>
          </div>
        </div>
        <div className="sort-menu-section">
          <div className="sort-menu-section-label">Payor Name</div>
          <div>
            <input
              type="radio"
              value="payerName-alphabetical"
              checked={currentSortOption === "payerName-alphabetical"}
              onChange={handleSortMenuFormChange}
              id="payerName-alphabetical"
              name="invoiceSort"
            />
            <label htmlFor="payerName-alphabetical">A-Z</label>
          </div>
          <div>
            <input
              type="radio"
              value="payerName-reverse"
              id="payerName-reverse"
              checked={currentSortOption === "payerName-reverse"}
              onChange={handleSortMenuFormChange}
              name="invoiceSort"
            />
            <label htmlFor="payerName-reverse">Z-A</label>
          </div>
        </div>
        <button className="sort-menu-apply-button">Apply</button>
      </div>
    </div>
  );

  const newInvoiceButton = (
    <button onClick={openInvoiceModal} className="new-invoice-button">
      <img alt="" src={Add}></img>{" "}
      <div className="new-invoice-button-label">Add New Invoice</div>
    </button>
  );

  const invoiceModal = (
    <div className="invoice-modal">
      <div className="modal-header">Add New Invoice</div>
      <button
        onClick={() => setInvoiceModalOpen(false)}
        className="modal-close-button"
      >
        X
      </button>
      <InputField
        name="payerName"
        label="Payer Name"
        type="text"
        onChange={handleNewInvoiceFormChange}
        placeholder="e.g. Jonathan Malka"
      />
      <InputField
        name="invoiceAmount"
        label="Invoice Amount"
        type="text"
        onChange={handleNewInvoiceFormChange}
        placeholder="e.g. 100000"
      />
      <InputField
        name="invoiceNumber"
        label="Invoice Number"
        type="text"
        onChange={handleNewInvoiceFormChange}
        placeholder="e.g. ab123"
      />

      <div className="invoice-modal-date-section">
        <InputField
          name="issueDate"
          label="Issue Date"
          type="date"
          onChange={handleNewInvoiceFormChange}
          required
        />
        <InputField
          name="dueDate"
          label="Due Date"
          type="date"
          onChange={handleNewInvoiceFormChange}
          required
        />
      </div>

      <button
        onClick={createInvoiceSubmit}
        className="invoice-modal-create-button"
      >
        Create
      </button>
    </div>
  );

  const auctionModal = (
    <div className="auction-modal">
      <div className="modal-header">Send Auction</div>
      <button
        onClick={() => setAuctionModalOpen(false)}
        className="modal-close-button"
      >
        X
      </button>
      <InputField
        name="minimumQuantity"
        label="Minimum Auction Amount ($)"
        type="text"
        onChange={handleSendToAuctionFormChange}
        placeholder="e.g. 100,000"
        min="0"
      />
      <div className="auction-modal-discount-section">
        <InputField
          name="discount"
          label="Maximum Discount Rate (%)"
          type="number"
          onChange={handleSendToAuctionFormDiscountChange}
          value={`${((1.0 - +sendToAuctionFormMinimumPrice) * 100).toFixed(1)}`}
          placeholder="e.g. 5"
          debounceTimeout={500}
        />
        <div className="or">
          <div>or</div>
        </div>
        <InputField
          name="minimumProceeds"
          label="Minimum Bid Amount ($)"
          type="number"
          placeholder="e.g. 10000"
          onChange={handleSendToAuctionFormMinimumQuantityChange}
          value={(
            +sendToAuctionFormState.minimumQuantity *
            +sendToAuctionFormMinimumPrice
          ).toFixed(0)}
          debounceTimeout={500}
        />
      </div>
      <InputField
        name="bidIncrement"
        label="Minimum Bid Increment ($)"
        type="text"
        onChange={handleSendToAuctionFormChange}
        placeholder="e.g. 500"
        min="0"
      />

      <div className="base-input-field">
        <label htmlFor="endDate">End Date</label>
        <input
          onChange={handleSendToAuctionFormChange}
          type="date"
          id="endDate"
          name="endDate"
        ></input>
      </div>

      <button
        onClick={sendToAuctionSubmit}
        className="invoice-modal-create-button"
      >
        Create
      </button>
    </div>
  );

  //#endregion

  return (
    <BasePage {...props}>
      <div className="page-subheader">
        <div className="page-subheader-text">Invoices</div>
        {newInvoiceButton}
        <div className="filter-sort-action-bar">
          {filterMenuArea}
          {sortMenuArea}
        </div>
      </div>
      <div className="invoices-list">{invoicesList}</div>
      {invoiceModalOpen &&
        createPortal(
          <div className="modal">{invoiceModal}</div>,
          document.body
        )}
      {auctionModalOpen &&
        createPortal(
          <div className="modal">{auctionModal}</div>,
          document.body
        )}
    </BasePage>
  );
};

export default InvoicesView;